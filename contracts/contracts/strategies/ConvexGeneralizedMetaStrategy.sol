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
            .mulTruncate(uint256(1e18) - MAX_SLIPPAGE);

        uint256 metapoolLp = metapool.add_liquidity(_amounts, minReceived);

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
        ICurvePool curvePool = ICurvePool(platformAddress);

        uint256 gaugeTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(
            address(this)
        );
        /**
         * Convert 3crv tokens to metapoolLP tokens. Since we have no use for the other token we are also
         * removing liquidity in the balanced manner (only removing 3CrvLP tokens)
         */
        // slither-disable-next-line divide-before-multiply
        uint256 estimationRequiredMetapoolLpTokens = curvePool
            .get_virtual_price()
            .divPrecisely(metapool.get_virtual_price())
            .mulTruncate(num3CrvTokens);

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

        if (requiredMetapoolLpTokens > 0) {
            // slither-disable-next-line unused-return
            metapool.remove_liquidity_one_coin(
                requiredMetapoolLpTokens,
                metapool3CrvCoinIndex,
                num3CrvTokens
            );
        }
    }

    function _lpWithdrawAll() internal override {
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

        if (gaugeTokens > 0) {
            uint256 burnDollarAmount = gaugeTokens.mulTruncate(
                metapool.get_virtual_price()
            );
            uint256 curve3PoolExpected = burnDollarAmount.divPrecisely(
                ICurvePool(platformAddress).get_virtual_price()
            );

            // Always withdraw all of the available metapool LP tokens (similar to how we always deposit all)
            // slither-disable-next-line unused-return
            metapool.remove_liquidity_one_coin(
                gaugeTokens,
                int128(metapool3CrvCoinIndex),
                curve3PoolExpected -
                    curve3PoolExpected.mulTruncate(maxWithdrawalSlippage)
            );
        }
    }
}
