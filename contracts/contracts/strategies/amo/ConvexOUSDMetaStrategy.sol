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

    // Store 8 bit decimals for each asset in the Curve pool
    // DAI at index 0 is 18 decimals (hex 12)
    // USDC at index 1 is 6 decimals (hex 6)
    // USDT at index 2 is 6 decimals (hex 6)
    uint256 private constant assetDecimals = 0x060612;
    address public constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;

    constructor(
        BaseStrategyConfig memory _baseConfig,
        ConvexAMOConfig memory _convexConfig
    ) BaseConvexAMOStrategy(_baseConfig, _convexConfig) {}

    /***************************************
        Vault to Pool Asset Conversions
    ****************************************/

    /// @dev 3CRV is the Vault asset and the Curve pool asset so nothing to do
    function _toPoolAsset(address _asset, uint256 _amount)
        internal
        override
        returns (uint256 poolAssets)
    {
        uint256 poolCoinIndex = _getCoinIndex(_asset);

        // 3Pool requires passing deposit amounts for all 3 assets, set to 0 for all
        uint256[3] memory _amounts;
        // Set the amount on the asset we want to deposit
        _amounts[poolCoinIndex] = _amount;
        uint256 depositValue = _amount
            .scaleBy(18, _getDecimals(poolCoinIndex))
            .divPrecisely(curvePool.get_virtual_price());
        uint256 minMintAmount = depositValue.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );
        // Do the deposit to 3pool
        ICurvePool(address(curvePool)).add_liquidity(_amounts, minMintAmount);

        poolAssets = asset.balanceOf(address(this));
    }

    /// @dev Converts 3CRV pool assets to the required number of vault assets
    function _toVaultAsset(address vaultAsset, uint256 assetAmount)
        internal
        override
    {
        uint256 contractCrv3Tokens = IERC20(asset).balanceOf(address(this));

        uint256 coinIndex = _getCoinIndex(vaultAsset);
        ICurvePool curvePool = ICurvePool(platformAddress);

        uint256 requiredCrv3Tokens = _calcCurveTokenAmount(
            coinIndex,
            assetAmount
        );

        // We have enough LP tokens, make sure they are all on this contract
        if (contractCrv3Tokens < requiredCrv3Tokens) {
            _lpWithdraw(requiredCrv3Tokens - contractCrv3Tokens);
        }

        uint256[3] memory _amounts = [uint256(0), uint256(0), uint256(0)];
        _amounts[coinIndex] = assetAmount;

        curvePool.remove_liquidity_imbalance(_amounts, requiredCrv3Tokens);
    }

    /// @dev Converts
    function _toVaultAsset() internal view override returns (uint256 assets) {
        assets = asset.balanceOf(address(this));
    }

    /***************************************
                    Curve Pool
    ****************************************/

    /// @dev Adds frxETH and/or OETH to the Curve pool
    /// @param amounts The amount of Curve pool assets and OTokens to add to the pool
    function _addLiquidityToPool(
        uint256[2] memory amounts,
        uint256 minMintAmount
    ) internal override returns (uint256 lpDeposited) {
        lpDeposited = curvePool.add_liquidity(amounts, minMintAmount);
    }

    /**
     * @dev Get the index of the coin
     */
    function _getCoinIndex(address _asset) internal pure returns (uint256) {
        if (_asset == DAI) {
            return 0;
        } else if (_asset == USDC) {
            return 1;
        } else if (_asset == USDT) {
            return 2;
        }
        revert("Unsupported asset");
    }

    function _getDecimals(uint256 poolCoinIndex)
        internal
        pure
        returns (uint8 decimals)
    {
        decimals = uint8(decimals >> poolCoinIndex);
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
        ICurvePool curvePool = ICurvePool(platformAddress);

        uint256[3] memory _amounts = [uint256(0), uint256(0), uint256(0)];
        _amounts[_coinIndex] = _amount;

        // LP required when removing required asset ignoring fees
        uint256 lpRequiredNoFees = curvePool.calc_token_amount(_amounts, false);
        /* LP required if fees would apply to entirety of removed amount
         *
         * fee is 1e10 denominated number: https://curve.readthedocs.io/exchange-pools.html#StableSwap.fee
         */
        uint256 lpRequiredFullFees = lpRequiredNoFees.mulTruncateScale(
            1e10 + curvePool.fee(),
            1e10
        );

        /* asset received when withdrawing full fee applicable LP accounting for
         * slippage and fees
         */
        uint256 assetReceivedForFullLPFees = curvePool.calc_withdraw_one_coin(
            lpRequiredFullFees,
            int128(uint128(_coinIndex))
        );

        // exact amount of LP required
        required3Crv =
            (lpRequiredFullFees * _amount) /
            assetReceivedForFullLPFees;
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
        returns (uint256 balance)
    {
        require(_asset == address(asset), "Unsupported asset");

        uint256 lpTokens = cvxRewardStaker.balanceOf(address(this));
        if (lpTokens > 0) {
            balance += (lpTokens * curvePool.get_virtual_price()) / 1e18;
        }
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

    /**
     * @dev Since we are unwrapping WETH before depositing it to Curve
     *      there is no need to to set an approval for WETH on the Curve
     *      pool
     * @param _asset Address of the asset
     * @param _pToken Address of the Curve LP token
     */
    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {}

    function _approveBase() internal override {
        // Approve Curve pool for frxETH and OETH (required for adding liquidity)
        // slither-disable-next-line unused-return
        oToken.approve(platformAddress, type(uint256).max);
        // slither-disable-next-line unused-return
        asset.approve(platformAddress, type(uint256).max);

        // Approve Convex deposit contract to transfer Curve pool LP tokens
        // This is needed for deposits if Curve pool LP tokens into the Convex rewards pool
        // slither-disable-next-line unused-return
        lpToken.approve(cvxDepositorAddress, type(uint256).max);
    }
}
