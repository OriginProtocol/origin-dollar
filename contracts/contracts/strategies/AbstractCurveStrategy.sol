// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Curve 3Pool Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICurvePool } from "./ICurvePool.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";

abstract contract AbstractCurveStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    uint256 internal constant MAX_SLIPPAGE = 1e16; // 1%, same as the Curve UI
    // number of assets in Curve 3Pool (USDC, DAI, USDT)
    uint256 internal constant THREEPOOL_ASSET_COUNT = 3;
    address internal pTokenAddress;

    int256[49] private __reserved;

    /**
     * @dev Deposit asset into the Curve 3Pool
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        require(_amount > 0, "Must deposit something");
        emit Deposit(_asset, pTokenAddress, _amount);

        // 3Pool requires passing deposit amounts for all 3 assets, set to 0 for
        // all
        uint256[3] memory _amounts;
        uint256 poolCoinIndex = _getCoinIndex(_asset);
        // Set the amount on the asset we want to deposit
        _amounts[poolCoinIndex] = _amount;
        ICurvePool curvePool = ICurvePool(platformAddress);
        uint256 assetDecimals = Helpers.getDecimals(_asset);
        uint256 depositValue = _amount.scaleBy(18, assetDecimals).divPrecisely(
            curvePool.get_virtual_price()
        );
        uint256 minMintAmount = depositValue.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );
        // Do the deposit to 3pool
        curvePool.add_liquidity(_amounts, minMintAmount);
        _lpDepositAll();
    }

    function _lpDepositAll() internal virtual;

    /**
     * @dev Deposit the entire balance of any supported asset into the Curve 3pool
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256[3] memory _amounts = [uint256(0), uint256(0), uint256(0)];
        uint256 depositValue = 0;
        ICurvePool curvePool = ICurvePool(platformAddress);
        uint256 curveVirtualPrice = curvePool.get_virtual_price();

        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < assetCount; i++) {
            address assetAddress = assetsMapped[i];
            uint256 balance = IERC20(assetAddress).balanceOf(address(this));
            if (balance > 0) {
                uint256 poolCoinIndex = _getCoinIndex(assetAddress);
                // Set the amount on the asset we want to deposit
                _amounts[poolCoinIndex] = balance;
                uint256 assetDecimals = Helpers.getDecimals(assetAddress);
                // Get value of deposit in Curve LP token to later determine
                // the minMintAmount argument for add_liquidity
                depositValue =
                    depositValue +
                    balance.scaleBy(18, assetDecimals).divPrecisely(
                        curveVirtualPrice
                    );
                emit Deposit(assetAddress, pTokenAddress, balance);
            }
        }

        uint256 minMintAmount = depositValue.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );
        // Do the deposit to 3pool
        curvePool.add_liquidity(_amounts, minMintAmount);

        /* In case of Curve Strategy all assets are mapped to the same pToken (3CrvLP). Let
         * descendants further handle the pToken. By either deploying it to the metapool and
         * resulting tokens in Gauge. Or deploying pTokens directly to the Gauge.
         */
        _lpDepositAll();
    }

    function _lpWithdraw(uint256 numCrvTokens) internal virtual;

    function _lpWithdrawAll() internal virtual;

    /**
     * @dev Withdraw asset from Curve 3Pool
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_amount > 0, "Invalid amount");

        emit Withdrawal(_asset, pTokenAddress, _amount);

        uint256 contractCrv3Tokens = IERC20(pTokenAddress).balanceOf(
            address(this)
        );

        uint256 coinIndex = _getCoinIndex(_asset);
        ICurvePool curvePool = ICurvePool(platformAddress);

        uint256 requiredCrv3Tokens = _calcCurveTokenAmount(coinIndex, _amount);

        // We have enough LP tokens, make sure they are all on this contract
        if (contractCrv3Tokens < requiredCrv3Tokens) {
            _lpWithdraw(requiredCrv3Tokens - contractCrv3Tokens);
        }

        uint256[3] memory _amounts = [uint256(0), uint256(0), uint256(0)];
        _amounts[coinIndex] = _amount;

        curvePool.remove_liquidity_imbalance(_amounts, requiredCrv3Tokens);
        IERC20(_asset).safeTransfer(_recipient, _amount);
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

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        _lpWithdrawAll();
        // Withdraws are proportional to assets held by 3Pool
        uint256[3] memory minWithdrawAmounts = [
            uint256(0),
            uint256(0),
            uint256(0)
        ];

        // Remove liquidity
        ICurvePool threePool = ICurvePool(platformAddress);
        threePool.remove_liquidity(
            IERC20(pTokenAddress).balanceOf(address(this)),
            minWithdrawAmounts
        );
        // Transfer assets out of Vault
        // Note that Curve will provide all 3 of the assets in 3pool even if
        // we have not set PToken addresses for all of them in this strategy
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            IERC20 asset = IERC20(threePool.coins(i));
            asset.safeTransfer(vaultAddress, asset.balanceOf(address(this)));
        }
    }

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        public
        view
        virtual
        override
        returns (uint256 balance)
    {
        require(assetToPToken[_asset] != address(0), "Unsupported asset");
        // LP tokens in this contract. This should generally be nothing as we
        // should always stake the full balance in the Gauge, but include for
        // safety
        uint256 totalPTokens = IERC20(pTokenAddress).balanceOf(address(this));
        ICurvePool curvePool = ICurvePool(platformAddress);
        if (totalPTokens > 0) {
            uint256 virtual_price = curvePool.get_virtual_price();
            uint256 value = (totalPTokens * virtual_price) / 1e18;
            uint256 assetDecimals = Helpers.getDecimals(_asset);
            balance = value.scaleBy(assetDecimals, 18) / THREEPOOL_ASSET_COUNT;
        }
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return assetToPToken[_asset] != address(0);
    }

    /**
     * @dev Approve the spending of all assets by their corresponding pool tokens,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        _approveBase();
        // This strategy is a special case since it only supports one asset
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            _approveAsset(assetsMapped[i]);
        }
    }

    /**
     * @dev Call the necessary approvals for the Curve pool and gauge
     * @param _asset Address of the asset
     */
    function _abstractSetPToken(address _asset, address) internal override {
        _approveAsset(_asset);
    }

    function _approveAsset(address _asset) internal {
        IERC20 asset = IERC20(_asset);
        // 3Pool for asset (required for adding liquidity)
        asset.safeApprove(platformAddress, 0);
        asset.safeApprove(platformAddress, type(uint256).max);
    }

    function _approveBase() internal virtual;

    /**
     * @dev Get the index of the coin
     */
    function _getCoinIndex(address _asset) internal view returns (uint256) {
        for (uint256 i = 0; i < 3; i++) {
            if (assetsMapped[i] == _asset) return i;
        }
        revert("Invalid 3pool asset");
    }
}
