// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Curve Convex Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { IRewardStaking } from "./IRewardStaking.sol";
import { IConvexDeposits } from "./IConvexDeposits.sol";
import { ICurvePool } from "./ICurvePool.sol";
import { IERC20, InitializableAbstractStrategy } from "./BaseCurveStrategy.sol";
import { BaseConvexMetaStrategy } from "./BaseConvexMetaStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { IVault } from "../interfaces/IVault.sol";

contract ConvexOUSDMetaStrategy is BaseConvexMetaStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    constructor(BaseStrategyConfig memory _stratConfig)
        InitializableAbstractStrategy(_stratConfig)
    {}

    /* Take 3pool LP and mint the corresponding amount of ousd. Deposit and stake that to
     * ousd Curve Metapool. Take the LP from metapool and deposit them to Convex.
     */
    function _lpDepositAll() internal override {
        ICurvePool curvePool = ICurvePool(platformAddress);

        uint256 threePoolLpBalance = IERC20(pTokenAddress).balanceOf(
            address(this)
        );
        uint256 curve3PoolVirtualPrice = curvePool.get_virtual_price();
        uint256 threePoolLpDollarValue = threePoolLpBalance.mulTruncate(
            curve3PoolVirtualPrice
        );

        // safe to cast since min value is at least 0
        uint256 ousdToAdd = uint256(
            _max(
                0,
                int256(
                    metapool.balances(crvCoinIndex).mulTruncate(
                        curve3PoolVirtualPrice
                    )
                ) -
                    int256(metapool.balances(mainCoinIndex)) +
                    int256(threePoolLpDollarValue)
            )
        );

        /* Add so much OUSD so that the pool ends up being balanced. And at minimum
         * add twice as much OUSD as 3poolLP and at maximum at twice as
         * much OUSD.
         */
        ousdToAdd = Math.max(ousdToAdd, threePoolLpDollarValue);
        ousdToAdd = Math.min(ousdToAdd, threePoolLpDollarValue * 2);

        /* Mint OUSD with a strategy that attempts to contribute to stability of OUSD metapool. Try
         * to mint so much OUSD that after deployment of liquidity pool ends up being balanced.
         *
         * To manage unpredictability minimal OUSD minted will always be at least equal or greater
         * to stablecoin(DAI, USDC, USDT) amount of 3CRVLP deployed. And never larger than twice the
         * stablecoin amount of 3CRVLP deployed even if it would have a further beneficial effect
         * on pool stability.
         */
        if (ousdToAdd > 0) {
            IVault(vaultAddress).mintForStrategy(ousdToAdd);
        }

        uint256[2] memory _amounts = [ousdToAdd, threePoolLpBalance];

        uint256 metapoolVirtualPrice = metapool.get_virtual_price();
        /**
         * First convert all the deposited tokens to dollar values,
         * then divide by virtual price to convert to metapool LP tokens
         * and apply the max slippage
         */
        uint256 minReceived = (ousdToAdd + threePoolLpDollarValue)
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
     * @param num3CrvTokens Number of 3CRV tokens to withdraw from metapool
     */
    function _lpWithdraw(uint256 num3CrvTokens) internal override {
        ICurvePool curvePool = ICurvePool(platformAddress);
        /* The rate between coins in the metapool determines the rate at which metapool returns
         * tokens when doing balanced removal (remove_liquidity call). And by knowing how much 3crvLp
         * we want we can determine how much of OUSD we receive by removing liquidity.
         *
         * Because we are doing balanced removal we should be making profit when removing liquidity in a
         * pool tilted to either side.
         *
         * Important: A downside is that the Strategist / Governor needs to be
         * cognisant of not removing too much liquidity. And while the proposal to remove liquidity
         * is being voted on the pool tilt might change so much that the proposal that has been valid while
         * created is no longer valid.
         */

        uint256 crvPoolBalance = metapool.balances(crvCoinIndex);
        /* K is multiplied by 1e36 which is used for higher precision calculation of required
         * metapool LP tokens. Without it the end value can have rounding errors up to precision of
         * 10 digits. This way we move the decimal point by 36 places when doing the calculation
         * and again by 36 places when we are done with it.
         */
        uint256 k = (1e36 * metapoolLPToken.totalSupply()) / crvPoolBalance;
        // simplifying below to: `uint256 diff = (num3CrvTokens - 1) * k` causes loss of precision
        // prettier-ignore
        // slither-disable-next-line divide-before-multiply
        uint256 diff = crvPoolBalance * k -
            (crvPoolBalance - num3CrvTokens - 1) * k;
        uint256 lpToBurn = diff / 1e36;

        uint256 gaugeTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(
            address(this)
        );

        require(
            lpToBurn <= gaugeTokens,
            string(
                bytes.concat(
                    bytes("Attempting to withdraw "),
                    bytes(Strings.toString(lpToBurn)),
                    bytes(", metapoolLP but only "),
                    bytes(Strings.toString(gaugeTokens)),
                    bytes(" available.")
                )
            )
        );

        // withdraw and unwrap with claim takes back the lpTokens and also collects the rewards for deposit
        IRewardStaking(cvxRewardStakerAddress).withdrawAndUnwrap(
            lpToBurn,
            true
        );

        // calculate the min amount of OUSD expected for the specified amount of LP tokens
        uint256 minOUSDAmount = lpToBurn.mulTruncate(
            metapool.get_virtual_price()
        ) -
            num3CrvTokens.mulTruncate(curvePool.get_virtual_price()) -
            1;

        // withdraw the liquidity from metapool
        uint256[2] memory _removedAmounts = metapool.remove_liquidity(
            lpToBurn,
            [minOUSDAmount, num3CrvTokens]
        );

        IVault(vaultAddress).burnForStrategy(_removedAmounts[mainCoinIndex]);
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
        uint256[2] memory _removedAmounts = metapool.remove_liquidity(
            metapoolErc20.balanceOf(address(this)),
            _minAmounts
        );

        IVault(vaultAddress).burnForStrategy(_removedAmounts[mainCoinIndex]);
    }
}
