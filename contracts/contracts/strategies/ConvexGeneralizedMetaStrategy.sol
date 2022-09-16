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

contract ConvexGeneralizedMetaStrategy is BaseConvexMetaStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    /* Take 3pool LP and deposit it to metapool. Take the LP from metapool
     * and deposit them to Convex.
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

        uint256[2] memory _amounts = [0, threePoolLpBalance];

        uint256 metapoolVirtualPrice = metapool.get_virtual_price();
        /**
         * First convert all the deposited tokens to dollar values,
         * then divide by virtual price to convert to metapool LP tokens
         * and apply the max slippage
         */
        uint256 minReceived = threePoolLpDollarValue
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
        uint256 estimationRequiredMetapoolLpTokens = (((curvePool
            .get_virtual_price() * 1e18) / metapool.get_virtual_price()) *
            num3CrvTokens) / 1e18;

        int128 metapool3CrvCoinIndex = int128(
            _getMetapoolCoinIndex(address(pTokenAddress))
        );

        // add 10% margin to the calculation of required tokens
        // slither-disable-next-line divide-before-multiply
        uint256 estimatedMetapoolLPWithMargin = (estimationRequiredMetapoolLpTokens *
                1100) / 1e3;
        uint256 crv3ReceivedWithMargin = metapool.calc_withdraw_one_coin(
            estimatedMetapoolLPWithMargin,
            metapool3CrvCoinIndex
        );
        uint256 requiredMetapoolLpTokens = (estimatedMetapoolLPWithMargin *
            num3CrvTokens) / crv3ReceivedWithMargin;

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

        uint256 burnAmount = metapoolErc20.balanceOf(address(this));
        if (burnAmount > 0) {
            // slither-disable-next-line unused-return
            metapool.remove_liquidity_one_coin(
                metapoolErc20.balanceOf(address(this)),
                metapool3CrvCoinIndex,
                num3CrvTokens
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

        uint128 metapool3CrvCoinIndex = _getMetapoolCoinIndex(
            address(pTokenAddress)
        );

        uint256 burnAmount = metapoolErc20.balanceOf(address(this));
        if (burnAmount > 0) {
            // Always withdraw all of the available metapool LP tokens (similar to how we always deposit all)
            // slither-disable-next-line unused-return
            metapool.remove_liquidity_one_coin(
                burnAmount,
                int128(metapool3CrvCoinIndex),
                uint256(0)
            );
        }
    }
}
