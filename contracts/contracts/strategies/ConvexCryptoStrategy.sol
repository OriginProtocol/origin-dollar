// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Curve CryptoSwap with Curve Gauge staking Strategy
 * @notice Investment into Curve CryptoSwap, eg TryLSD, and Liquidity Provider (LP) tokens in a Convex pool.
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICurveGauge } from "./curve/ICurveGauge.sol";
import { ICurveCrypto } from "./curve/ICurveCrypto.sol";
import { CurveFunctions, CurveCryptoFunctions } from "./curve/CurveCryptoFunctions.sol";
import { IERC20, BaseCurveStrategy, InitializableAbstractStrategy } from "./BaseCurveStrategy.sol";
import { ConvexStrategy } from "./ConvexStrategy.sol";
import { IRewardStaking } from "./IRewardStaking.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IVault } from "../interfaces/IVault.sol";

contract ConvexCryptoStrategy is CurveCryptoFunctions, ConvexStrategy {
    constructor(
        BaseStrategyConfig memory _stratConfig,
        CurveConfig memory _config,
        CurveConfig memory _curveConfig,
        ConvexConfig memory _convexConfig
    )
        InitializableAbstractStrategy(_stratConfig)
        BaseCurveStrategy(_config)
        ConvexStrategy(_convexConfig)
        CurveCryptoFunctions(_config.curvePool)
    {}

    function getCurveFunctions()
        internal
        pure
        override(BaseCurveStrategy, CurveCryptoFunctions)
        returns (CurveFunctions memory)
    {
        return CurveCryptoFunctions.getCurveFunctions();
    }

    /**
     * @notice Get the asset's share of Curve LP value controlled by this strategy. This is the total value
     * of the Curve LP tokens staked in Convex and held in this strategy contract
     * weighted by the price of each of the Curve pool assets.
     * The weighted average is taken prevent the asset balances being manipulated by tilting the Curve pool.
     * @dev An invalid `_asset` will fail in `_getAssetDecimals` with "Unsupported asset"
     * @param _asset      Address of the asset
     * @return balance    Virtual balance of the asset
     */
    function checkBalance(address _asset)
        public
        view
        override
        returns (uint256 balance)
    {
        require(_curveSupportedCoin(_asset), "Not a Curve pool coin");

        // Curve LP tokens in this contract. This should generally be nothing as we
        // should always stake the full balance in the Gauge, but include for
        // safety
        uint256 contractLpTokens = IERC20(CURVE_LP_TOKEN).balanceOf(
            address(this)
        );

        // Get the Curve LP tokens staked in the Convex pool.
        uint256 convexLpTokens = IRewardStaking(cvxRewardStaker).balanceOf(
            address(this)
        );
        uint256 totalLpToken = contractLpTokens + convexLpTokens;

        if (totalLpToken > 0) {
            // get the Strategy's total LP token value priced in the first token in the Curve pool.
            // eg wsthETH for TryLSD
            uint256 totalInCoin0 = (totalLpToken *
                ICurveCrypto(CURVE_POOL).get_virtual_price()) / 1e18;

            address priceProvider = IVault(vaultAddress).priceProvider();
            // The the exchange for the first token in the Curve pool to ETH
            uint256 priceCoin0 = IOracle(priceProvider).price(coin0);

            // the Strategy's total LP token value priced in ETH
            uint256 totalInEth = totalInCoin0 * priceCoin0;

            // Divide by the number of assets in the Curve pool. eg 3 for the TryLSD pool.
            // An average is taken to prevent the balances being manipulated by tilting the Curve pool.
            // No matter what the balance of the asset in the Curve pool is, the value of each asset will
            // be the average of the Curve pool's total value.
            balance = totalInEth / CURVE_POOL_ASSETS_COUNT;
        }
    }
}
