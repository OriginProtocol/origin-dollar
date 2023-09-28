// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Curve Strategy for pools with twp assets
 * @notice Investment strategy for investing assets via a Curve pool. eg frxETH/ETH
 * @dev There are a number of restrictions on which Curve pools can be used by this strategy
 * - all assets have the same decimals as the Curve pool's LP token. eg 18
 * - the Curve pool and Curve pool LP token are the same contract.
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICurveMetaPool } from "./ICurveMetaPool.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";

abstract contract BaseTwoAssetCurveStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant MAX_SLIPPAGE = 1e16; // 1%, same as the Curve UI
    /// @notice number of assets in base Curve pool
    uint256 public constant CURVE_BASE_ASSETS = 2;

    int256[49] private __reserved;

    /**
     * @dev Deposit asset into the Curve pool
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
        emit Deposit(_asset, platformAddress, _amount);

        // Curve requires passing deposit amounts for all assets
        uint256[CURVE_BASE_ASSETS] memory _amounts = [uint256(0), 0];
        // Validate the asset and get Curve pool index position
        uint256 poolCoinIndex = _getCoinIndex(_asset);
        // Set the amount on the asset we want to deposit
        _amounts[poolCoinIndex] = _amount;
        ICurveMetaPool curvePool = ICurveMetaPool(platformAddress);
        uint256 depositValue = _amount.divPrecisely(
            curvePool.get_virtual_price()
        );
        uint256 minMintAmount = depositValue.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );
        // Do the deposit to the Curve pool
        // slither-disable-next-line unused-return
        curvePool.add_liquidity(_amounts, minMintAmount);
        _lpDepositAll();
    }

    function _lpDepositAll() internal virtual;

    /**
     * @dev Deposit the entire balance of any supported asset into the Curve pool
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256[CURVE_BASE_ASSETS] memory _amounts = [uint256(0), 0];
        uint256 depositValue = 0;
        ICurveMetaPool curvePool = ICurveMetaPool(platformAddress);
        uint256 curveVirtualPrice = curvePool.get_virtual_price();

        for (uint256 i = 0; i < assetsMapped.length; ++i) {
            address assetAddress = assetsMapped[i];
            uint256 balance = IERC20(assetAddress).balanceOf(address(this));
            if (balance > 0) {
                uint256 poolCoinIndex = _getCoinIndex(assetAddress);
                // Set the amount on the asset we want to deposit
                _amounts[poolCoinIndex] = balance;
                // Get value of deposit in Curve LP token to later determine
                // the minMintAmount argument for add_liquidity
                depositValue =
                    depositValue +
                    balance.divPrecisely(curveVirtualPrice);
                emit Deposit(assetAddress, platformAddress, balance);
            }
        }

        uint256 minMintAmount = depositValue.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );
        // Do the deposit to the Curve pool
        // slither-disable-next-line unused-return
        curvePool.add_liquidity(_amounts, minMintAmount);

        /* In case of Curve Strategy all assets are mapped to the same pToken (Curve pool). Let
         * descendants further handle the pToken. By either deploying it to the Curve pool and
         * resulting tokens in Gauge. Or deploying pTokens directly to the Gauge.
         */
        _lpDepositAll();
    }

    function _lpWithdraw(uint256 numLpTokens) internal virtual;

    function _lpWithdrawAll() internal virtual;

    /**
     * @dev Withdraw asset from the Curve pool
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

        emit Withdrawal(_asset, platformAddress, _amount);

        uint256 contractLpTokens = IERC20(platformAddress).balanceOf(
            address(this)
        );

        uint256 coinIndex = _getCoinIndex(_asset);
        ICurveMetaPool curvePool = ICurveMetaPool(platformAddress);

        uint256 requiredLpTokens = _calcCurveTokenAmount(coinIndex, _amount);

        // We have enough LP tokens, make sure they are all on this contract
        if (contractLpTokens < requiredLpTokens) {
            _lpWithdraw(requiredLpTokens - contractLpTokens);
        }

        uint256[CURVE_BASE_ASSETS] memory _amounts = [uint256(0), 0];
        _amounts[coinIndex] = _amount;

        // slither-disable-next-line unused-return
        curvePool.remove_liquidity_imbalance(
            _amounts,
            requiredLpTokens,
            _recipient
        );
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
        view
        returns (uint256 requiredLpTokens)
    {
        ICurveMetaPool curvePool = ICurveMetaPool(platformAddress);

        uint256[CURVE_BASE_ASSETS] memory _amounts = [uint256(0), 0];
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
        requiredLpTokens =
            (lpRequiredFullFees * _amount) /
            assetReceivedForFullLPFees;
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        _lpWithdrawAll();

        // Withdraws are proportional to assets held by Curve pool
        uint256[CURVE_BASE_ASSETS] memory minWithdrawAmounts = [uint256(0), 0];

        // Remove liquidity
        ICurveMetaPool curvePool = ICurveMetaPool(platformAddress);
        // slither-disable-next-line unused-return
        curvePool.remove_liquidity(
            IERC20(platformAddress).balanceOf(address(this)),
            minWithdrawAmounts
        );
        // Transfer assets out of Vault
        // Note that Curve will provide all of the assets in the pool even if
        // we have not set PToken addresses for all of them in this strategy
        for (uint256 i = 0; i < assetsMapped.length; ++i) {
            IERC20 asset = IERC20(curvePool.coins(i));
            uint256 balance = asset.balanceOf(address(this));
            asset.safeTransfer(vaultAddress, balance);

            emit Withdrawal(address(asset), platformAddress, balance);
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
        uint256 totalPTokens = IERC20(platformAddress).balanceOf(address(this));
        ICurveMetaPool curvePool = ICurveMetaPool(platformAddress);
        if (totalPTokens > 0) {
            uint256 virtual_price = curvePool.get_virtual_price();
            uint256 value = (totalPTokens * virtual_price) / 1e18;
            balance = value / CURVE_BASE_ASSETS;
        }
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset)
        external
        view
        override
        returns (bool)
    {
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
        for (uint256 i = 0; i < assetsMapped.length; ++i) {
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
        // Approve the Curve pool to transfer an asset (required for adding liquidity)
        asset.safeApprove(platformAddress, 0);
        asset.safeApprove(platformAddress, type(uint256).max);
    }

    function _approveBase() internal virtual;

    /**
     * @dev Get the index of the coin
     */
    function _getCoinIndex(address _asset) internal view returns (uint256) {
        for (uint256 i = 0; i < CURVE_BASE_ASSETS; ++i) {
            if (assetsMapped[i] == _asset) return i;
        }
        revert("Invalid asset");
    }
}
