// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Convex Automated Market Maker (AMO) Strategy
 * @notice AMO strategy for the Curve OUSD/3CRV pool
 * @author Origin Protocol Inc
 */
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { BaseConvexAMOStrategy } from "./BaseConvexAMOStrategy.sol";
import { ICurvePool } from "../ICurvePool.sol";
import { StableMath } from "../../utils/StableMath.sol";

contract ConvexOUSDMetaStrategy is BaseConvexAMOStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    uint256 internal constant THREEPOOL_ASSET_COUNT = 3;

    address public immutable DAI;
    address public immutable USDC;
    address public immutable USDT;
    ICurvePool public immutable curve3Pool;

    constructor(
        BaseStrategyConfig memory _baseConfig,
        ConvexAMOConfig memory _convexConfig,
        address _curve3Pool,
        address[3] memory _curve3PoolAssets
    ) BaseConvexAMOStrategy(_baseConfig, _convexConfig) {
        DAI = _curve3PoolAssets[0];
        USDC = _curve3PoolAssets[1];
        USDT = _curve3PoolAssets[2];
        curve3Pool = ICurvePool(_curve3Pool);
    }

    /***************************************
            Vault Asset Validation
    ****************************************/

    function _isVaultAsset(address _vaultAsset)
        internal
        view
        override
        returns (bool supported)
    {
        supported =
            _vaultAsset == DAI ||
            _vaultAsset == USDC ||
            _vaultAsset == USDT;
    }

    /***************************************
        Vault to Pool Asset Conversions
    ****************************************/

    /// @dev DAI, USDC or USDC is the Vault asset and the Curve 3Pool lp token 3CRV is
    /// is Curve's OUSD/3CRV Metapool asset
    function _toPoolAsset(address _asset, uint256 _amount)
        internal
        override
        returns (uint256 poolAssets)
    {
        (uint256 poolCoinIndex, uint256 decimals) = _coinIndexDecimals(_asset);

        // 3Pool requires passing deposit amounts for all 3 assets, set to 0 for all
        uint256[3] memory _amounts;
        // Set the amount on the asset we want to deposit
        _amounts[poolCoinIndex] = _amount;
        uint256 minMintAmount = _amount
            .scaleBy(18, decimals)
            .divPrecisely(curve3Pool.get_virtual_price())
            .mulTruncate(uint256(1e18) - MAX_SLIPPAGE);

        // Do the deposit to 3pool
        curve3Pool.add_liquidity(_amounts, minMintAmount);

        poolAssets = asset.balanceOf(address(this));
    }

    /// @dev Converts 3CRV pool assets to the required number of vault assets
    function _toVaultAsset(address vaultAsset, uint256 assetAmount)
        internal
        override
    {
        uint256 contractCrv3Tokens = IERC20(asset).balanceOf(address(this));

        (uint256 poolCoinIndex, ) = _coinIndexDecimals(vaultAsset);

        uint256 requiredCrv3Tokens = _calcCurveTokenAmount(
            poolCoinIndex,
            assetAmount
        );

        // We have enough LP tokens, make sure they are all on this contract
        if (contractCrv3Tokens < requiredCrv3Tokens) {
            _lpWithdraw(requiredCrv3Tokens - contractCrv3Tokens);
        }

        uint256[3] memory _amounts = [uint256(0), uint256(0), uint256(0)];
        _amounts[poolCoinIndex] = assetAmount;

        curve3Pool.remove_liquidity_imbalance(_amounts, requiredCrv3Tokens);
    }

    /// @dev Converts all 3CRV in this strategy to the Vault assets DAI, USDC and USDT
    /// by removing liquidity from the Curve OUSD/3CRV Metapool.
    /// Then transfers each vault asset to the vault.
    function _withdrawAllAsset() internal override {
        // Withdraws are proportional to assets held by 3Pool
        uint256[3] memory minWithdrawAmounts = [
            uint256(0),
            uint256(0),
            uint256(0)
        ];

        // Remove liquidity
        curve3Pool.remove_liquidity(
            IERC20(asset).balanceOf(address(this)),
            minWithdrawAmounts
        );

        // Transfer assets to the Vault
        // Note that Curve will provide all 3 of the assets in 3pool even if
        // we have not set PToken addresses for all of them in this strategy
        _transferAssetBalance(IERC20(DAI));
        _transferAssetBalance(IERC20(USDC));
        _transferAssetBalance(IERC20(USDT));
    }

    function _transferAssetBalance(IERC20 asset) internal {
        uint256 assetBalance = asset.balanceOf(address(this));
        if (assetBalance > 0) {
            asset.safeTransfer(vaultAddress, assetBalance);
            emit Withdrawal(address(asset), address(lpToken), assetBalance);
        }
    }

    /***************************************
                    Curve Pool
    ****************************************/

    /// @dev Adds 3CRV and/or OUSD to the Curve OUSD/3CRV Metapool
    /// @param amounts The amount of Curve pool assets and OTokens to add to the pool
    function _addLiquidityToPool(
        uint256[2] memory amounts,
        uint256 minMintAmount
    ) internal override returns (uint256 lpDeposited) {
        lpDeposited = curvePool.add_liquidity(amounts, minMintAmount);
    }

    /**
     * @dev Get the asset token's index position in the Curve 3Pool
     * and the token's decimals.
     */
    function _coinIndexDecimals(address _asset)
        internal
        view
        returns (uint256 index, uint256 decimals)
    {
        if (_asset == DAI) {
            return (0, 18);
        } else if (_asset == USDC) {
            return (1, 6);
        } else if (_asset == USDT) {
            return (2, 6);
        }
        revert("Unsupported asset");
    }

    /**
     * @dev Calculate amount of LP required when withdrawing specific amount of one
     * of the underlying assets accounting for fees and slippage.
     *
     * Curve pools unfortunately do not contain a calculation function for
     * amount of LP required when withdrawing a specific amount of one of the
     * underlying tokens and also accounting for fees (Curve's calc_token_amount
     * does account for slippage but not fees).
     *
     * Steps taken to calculate the metric:
     *  - get amount of LP required if fees wouldn't apply
     *  - increase the LP amount as if fees would apply to the entirety of the underlying
     *    asset withdrawal. (when withdrawing only one coin fees apply only to amounts
     *    of other assets pool would return in case of balanced removal - since those need
     *    to be swapped for the single underlying asset being withdrawn)
     *  - get amount of underlying asset withdrawn (this Curve function does consider slippage
     *    and fees) when using the increased LP amount. As LP amount is slightly over-increased
     *    so is amount of underlying assets returned.
     *  - since we know exactly how much asset we require take the rate of LP required for asset
     *    withdrawn to get the exact amount of LP.
     */
    function _calcCurveTokenAmount(uint256 _coinIndex, uint256 _amount)
        internal
        returns (uint256 required3Crv)
    {
        uint256[3] memory _amounts = [uint256(0), uint256(0), uint256(0)];
        _amounts[_coinIndex] = _amount;

        // LP required when removing required asset ignoring fees
        uint256 lpRequiredNoFees = curve3Pool.calc_token_amount(
            _amounts,
            false
        );
        /* LP required if fees would apply to entirety of removed amount
         *
         * fee is 1e10 denominated number: https://curve.readthedocs.io/exchange-pools.html#StableSwap.fee
         */
        uint256 lpRequiredFullFees = lpRequiredNoFees.mulTruncateScale(
            1e10 + curve3Pool.fee(),
            1e10
        );

        /* asset received when withdrawing full fee applicable LP accounting for
         * slippage and fees
         */
        uint256 assetReceivedForFullLPFees = curve3Pool.calc_withdraw_one_coin(
            lpRequiredFullFees,
            int128(uint128(_coinIndex))
        );

        // exact amount of LP required
        required3Crv =
            (lpRequiredFullFees * _amount) /
            assetReceivedForFullLPFees;
    }

    function depositAll() external override onlyVault nonReentrant {
        uint256[3] memory amounts = [uint256(0), uint256(0), uint256(0)];
        uint256 depositValue = 0;
        uint256 curve3PoolVirtualPrice = curve3Pool.get_virtual_price();

        depositValue = _addAmount(amounts, DAI, curve3PoolVirtualPrice);
        depositValue += _addAmount(amounts, USDC, curve3PoolVirtualPrice);
        depositValue += _addAmount(amounts, USDT, curve3PoolVirtualPrice);

        uint256 minMintAmount = depositValue.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // deposit DAI, USDC and/or USDT to the Curve 3Pool
        curve3Pool.add_liquidity(amounts, minMintAmount);

        // Get the Curve OUSD/3CRV Metapool LP token balance of this strategy contract
        uint256 threePoolLpBalance = asset.balanceOf(address(this));

        // AMO deposit to the Curve Metapool
        _deposit(threePoolLpBalance);
    }

    function _addAmount(
        uint256[3] memory amounts,
        address usdAsset,
        uint256 curve3PoolVirtualPrice
    ) internal returns (uint256 depositValue) {
        uint256 balance = IERC20(usdAsset).balanceOf(address(this));
        if (balance > 0) {
            (uint256 poolCoinIndex, uint256 assetDecimals) = _coinIndexDecimals(
                usdAsset
            );
            // Set the amount on the asset we want to deposit
            amounts[poolCoinIndex] = balance;
            // Get value of deposit in Curve LP token to later determine
            // the minMintAmount argument for add_liquidity
            depositValue = balance.scaleBy(18, assetDecimals).divPrecisely(
                curve3PoolVirtualPrice
            );
            emit Deposit(usdAsset, address(lpToken), balance);
        }
    }

    /***************************************
                Asset Balance
    ****************************************/

    /**
     * @notice Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        public
        view
        override
        onlyAsset(_asset)
        returns (uint256 balance)
    {
        // OUSD/3CRV Metapool LP tokens in this strategy contract.
        // This should generally be nothing as we should always stake
        // the full balance in the Gauge, but include for safety
        uint256 metapoolLpTokens = IERC20(asset).balanceOf(address(this));
        if (metapoolLpTokens > 0) {
            balance = metapoolLpTokens.mulTruncate(
                curvePool.get_virtual_price()
            );
        }

        /* We intentionally omit the metapoolLp tokens held by the metastrategyContract
         * since the contract should never (except in the middle of deposit/withdrawal
         * transaction) hold any amount of those tokens in normal operation. There
         * could be tokens sent to it by a 3rd party and we decide to actively ignore
         * those.
         */
        uint256 metapoolGaugePTokens = cvxRewardStaker.balanceOf(address(this));

        if (metapoolGaugePTokens > 0) {
            uint256 value = metapoolGaugePTokens.mulTruncate(
                curvePool.get_virtual_price()
            );
            balance += value;
        }

        (, uint256 assetDecimals) = _coinIndexDecimals(_asset);
        balance = balance.scaleBy(assetDecimals, 18) / THREEPOOL_ASSET_COUNT;
    }

    /***************************************
                    Approvals
    ****************************************/

    /**
     * @notice Approve the spending of all assets by their corresponding pool tokens,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        _approveBase();
    }

    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {}

    function _approveBase() internal override {
        // Approve Curve 3Pool for DAI, USDC and USDT
        IERC20(DAI).approve(address(curve3Pool), type(uint256).max);
        IERC20(USDC).approve(address(curve3Pool), type(uint256).max);
        IERC20(USDT).approve(address(curve3Pool), type(uint256).max);

        // Approve Curve OUSD/3CRV Metapool for 3CRV and OUSD (required for adding liquidity)
        // slither-disable-next-line unused-return
        oToken.approve(address(curvePool), type(uint256).max);
        // slither-disable-next-line unused-return
        asset.approve(address(curvePool), type(uint256).max);

        // Approve Convex deposit contract to transfer Curve pool LP tokens
        // This is needed for deposits if Curve pool LP tokens into the Convex rewards pool
        // slither-disable-next-line unused-return
        lpToken.approve(cvxDepositorAddress, type(uint256).max);
    }
}
