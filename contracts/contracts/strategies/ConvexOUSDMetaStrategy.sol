// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Curve Convex Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import { IRewardStaking } from "./IRewardStaking.sol";
import { IConvexDeposits } from "./IConvexDeposits.sol";
import { ICurvePool } from "./ICurvePool.sol";
import { IERC20 } from "./BaseCurveStrategy.sol";
import { BaseConvexMetaStrategy } from "./BaseConvexMetaStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { IVault } from "../interfaces/IVault.sol";

contract ConvexOUSDMetaStrategy is BaseConvexMetaStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    /* Take 3pool LP and mint the corresponding amount of ousd. Deposit and stake that to
     * ousd Curve Metapool. Take the LP from metapool and deposit them to Convex.
     */
    function _lpDepositAll() internal override {
        IERC20 threePoolLp = IERC20(pTokenAddress);
        IERC20 metapoolErc20 = IERC20(address(metapool));
        ICurvePool curvePool = ICurvePool(platformAddress);

        uint256 threePoolLpBalance = threePoolLp.balanceOf(address(this));
        uint256 curve3PoolVirtualPrice = curvePool.get_virtual_price();
        uint256 threePoolLpDollarValue = threePoolLpBalance.mulTruncate(
            curve3PoolVirtualPrice
        );

        uint128 crvCoinIndex = _getMetapoolCoinIndex(pTokenAddress);
        uint128 ousdCoinIndex = _getMetapoolCoinIndex(
            address(metapoolMainToken)
        );

        uint256 ousdToAdd = toPositive(
            int256(
                metapool.balances(crvCoinIndex).mulTruncate(
                    curve3PoolVirtualPrice
                )
            ) -
                int256(metapool.balances(ousdCoinIndex)) +
                int256(threePoolLpDollarValue)
        );

        /* Mint so much ousd that the dollar value of 3CRVLP in the pool and OUSD will be equal after
         * deployment of liquidity. In cases where pool is heavier in OUSD before the deposit strategy mints
         * less OUSD and gets less metapoolLP and less rewards. And when pool is heavier in 3CRV strategy mints
         * more OUSD and gets more metapoolLP and more rewards.
         *
         * In both cases metapool ends up being balanced and there should be no incentive to execute arbitrage trade.
         */
        if (ousdToAdd > 0) {
            IVault(vaultAddress).mintForStrategy(ousdToAdd);
        }

        uint256 ousdBalance = metapoolMainToken.balanceOf(address(this));
        uint256[2] memory _amounts = [ousdBalance, threePoolLpBalance];

        uint256 metapoolVirtualPrice = metapool.get_virtual_price();
        /**
         * First convert all the deposited tokens to dollar values,
         * then divide by virtual price to convert to metapool LP tokens
         * and apply the max slippage
         */
        uint256 minReceived = (ousdBalance + threePoolLpDollarValue)
            .divPrecisely(metapoolVirtualPrice)
            .mulTruncate(uint256(1e18) - maxSlippage);

        // slither-disable-next-line unused-return
        metapool.add_liquidity(_amounts, minReceived);

        uint256 metapoolLp = metapoolErc20.balanceOf(address(this));

        bool success = IConvexDeposits(cvxDepositorAddress).deposit(
            cvxDepositorPTokenId,
            metapoolLp,
            true // Deposit with staking
        );

        require(success, "Failed to deposit to Convex");
    }

    /**
     * Withdraw the specified amount of tokens from the gauge. And use all the resulting tokens
     * to remove liquidity from metapool
     * @param num3CrvTokens Number of Convex LP tokens to remove from gauge
     */
    function _lpWithdraw(uint256 num3CrvTokens) internal override {
        IERC20 metapoolErc20 = IERC20(address(metapool));
        ICurvePool curvePool = ICurvePool(platformAddress);

        uint256 gaugeTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(
            address(this)
        );
        uint256 crv3VirtualPrice = curvePool.get_virtual_price();
        /**
         * Convert 3crv tokens to metapoolLP tokens and double it. Doubling is required because aside
         * from receiving 3crv we are also withdrawing OUSD. Instead of removing liquidity in an imbalanced
         * manner the preference is to remove it in a balanced manner and perform a swap on the metapool to
         * make up for the token imbalance. The reason for this unpredictability is that the pool can be
         * balanced either in OUSD direction or 3Crv.
         *
         * Analysis has confirmed that: `It is more cost effective to remove liquidity in balanced manner and
         * make up for the difference with additional swap. Comparing to removing liquidity in imbalanced manner.`
         * Results of analysis here: https://docs.google.com/spreadsheets/d/1DYSyYwHqxRzSJh9dYkY5kcgP_K5gku6N2mQVhoH33vY
         * run it yourself using code in brownie/scripts/liqidity_test.py
         */
        // slither-disable-next-line divide-before-multiply
        uint256 requiredMetapoolLpTokens = ((num3CrvTokens * crv3VirtualPrice) /
            1e18 /
            metapool.get_virtual_price()) *
            1e18 *
            2;

        require(
            requiredMetapoolLpTokens <= gaugeTokens,
            string(
                bytes.concat(
                    bytes("Attempting to withdraw "),
                    bytes(Strings.toString(requiredMetapoolLpTokens)),
                    bytes(", metapoolLP but only "),
                    bytes(Strings.toString(gaugeTokens)),
                    bytes(" available.")
                )
            )
        );

        // withdraw and unwrap with claim takes back the lpTokens and also collects the rewards for deposit
        IRewardStaking(cvxRewardStakerAddress).withdrawAndUnwrap(
            requiredMetapoolLpTokens,
            true
        );

        uint256[2] memory _minAmounts = [uint256(0), uint256(0)];
        // always withdraw all of the available metapool LP tokens (similar to how we always deposit all)
        uint256[2] memory removedCoins = metapool.remove_liquidity(
            metapoolErc20.balanceOf(address(this)),
            _minAmounts
        );

        uint128 crvCoinIndex = _getMetapoolCoinIndex(pTokenAddress);
        uint128 ousdCoinIndex = _getMetapoolCoinIndex(
            address(metapoolMainToken)
        );

        // Receive too much 3crv
        if (removedCoins[uint256(crvCoinIndex)] > num3CrvTokens) {
            /**
             * TODO: should there be a gas saving threshold, to not perform a swap if value diff is
             * relatively small
             */
            // slither-disable-next-line unused-return
            metapool.exchange(
                int128(crvCoinIndex),
                int128(ousdCoinIndex),
                removedCoins[uint256(crvCoinIndex)] - num3CrvTokens,
                0
            );
        }
        // We don't have enough 3CRV we need to swap for more
        else {
            uint256 required3Crv = num3CrvTokens -
                removedCoins[uint256(crvCoinIndex)];
            /**
             * We first multiply the required3CRV with the virtual price so that we get a dollar
             * value (i.e. OUSD value) of 3CRV required and we increase that by 5% for safety threshold
             */
            // slither-disable-next-line divide-before-multiply
            uint256 ousdWithThreshold = (((required3Crv * crv3VirtualPrice) /
                1e18) * 105) / 100;
            uint256 crv3Received = metapool.get_dy(
                int128(ousdCoinIndex), // Index value of the coin to send
                int128(crvCoinIndex), // Index value of the coin to receive
                ousdWithThreshold // The amount of first coin being exchanged
            );

            // slither-disable-next-line unused-return
            metapool.exchange(
                int128(ousdCoinIndex),
                int128(crvCoinIndex),
                // below is ousd to swap
                (required3Crv * ousdWithThreshold) / crv3Received,
                0
            );
        }

        uint256 ousdToBurn = metapoolMainToken.balanceOf(address(this));
        if (ousdToBurn > 0) {
            IVault(vaultAddress).redeemForStrategy(
                ousdToBurn
            );
        }
    }

    function _lpWithdrawAll() internal override {
        IERC20 metapoolErc20 = IERC20(address(metapool));
        uint256 gaugeTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(
            address(this)
        );
        IRewardStaking(cvxRewardStakerAddress).withdrawAndUnwrap(
            gaugeTokens,
            true
        );

        uint256[2] memory _minAmounts = [uint256(0), uint256(0)];
        // slither-disable-next-line unused-return
        metapool.remove_liquidity(
            metapoolErc20.balanceOf(address(this)),
            _minAmounts
        );

        uint256 ousdToBurn = metapoolMainToken.balanceOf(address(this));
        if (ousdToBurn > 0) {
            IVault(vaultAddress).redeemForStrategy(
                ousdToBurn
            );
        }
    }
}
