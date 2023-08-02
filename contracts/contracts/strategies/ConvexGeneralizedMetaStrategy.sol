// SPDX-License-Identifier: MIT
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
import { IERC20, InitializableAbstractStrategy } from "./BaseCurveStrategy.sol";
import { BaseConvexMetaStrategy } from "./BaseConvexMetaStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";

contract ConvexGeneralizedMetaStrategy is BaseConvexMetaStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    constructor(BaseStrategyConfig memory _stratConfig)
        InitializableAbstractStrategy(_stratConfig)
    {}

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
     * @param num3CrvTokens Number of Convex 3pool LP tokens to withdraw from metapool
     */
    function _lpWithdraw(uint256 num3CrvTokens) internal override {
        uint256 gaugeTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(
            address(this)
        );

        uint256 requiredMetapoolLpTokens = _calcCurveMetaTokenAmount(
            crvCoinIndex,
            num3CrvTokens
        );

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
                int128(crvCoinIndex),
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
                int128(crvCoinIndex),
                curve3PoolExpected -
                    curve3PoolExpected.mulTruncate(maxWithdrawalSlippage)
            );
        }
    }
}
