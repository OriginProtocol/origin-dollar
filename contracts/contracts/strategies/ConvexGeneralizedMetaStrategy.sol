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
import { ICurvePool } from "./curve/ICurvePool.sol";
import { CurveThreeCoin } from "./curve/CurveThreeCoin.sol";
import { IERC20, InitializableAbstractStrategy } from "./BaseCurveStrategy.sol";
import { BaseConvexMetaStrategy, BaseCurveStrategy } from "./BaseConvexMetaStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";

contract ConvexGeneralizedMetaStrategy is
    BaseConvexMetaStrategy,
    CurveThreeCoin
{
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    constructor(
        BaseStrategyConfig memory _stratConfig,
        CurveConfig memory _curveConfig
    )
        InitializableAbstractStrategy(_stratConfig)
        BaseCurveStrategy(_curveConfig)
    {}

    /* Take 3pool LP and deposit it to metapool. Take the LP from metapool
     * and deposit them to Convex.
     */
    function _lpDepositAll() internal override {
        IERC20 threePoolLp = IERC20(CURVE_LP_TOKEN);
        ICurvePool curvePool = ICurvePool(CURVE_POOL);

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

    /**
     * @notice Deposit coins into a Curve pool
     * @param _pool Address of the Curve pool
     * @param _amounts List of amounts of coins to deposit
     * @param _min_mint_amount Minimum amount of LP tokens to mint from the deposit
     */
    function _curve_add_liquidity(
        address _pool,
        uint256[] memory _amounts,
        uint256 _min_mint_amount
    ) internal override(BaseCurveStrategy, CurveThreeCoin) {
        _curve_add_liquidity(_pool, _amounts, _min_mint_amount);
    }

    /**
     * @notice Calculate amount of LP required when withdrawing specific amount of one
     * of the underlying assets accounting for fees and slippage.
     * @param _pool Address of the Curve pool
     * @param _coinIndex index of the coin in the Curve pool that is to be withdrawn
     * @param _assetAmount Amount of of the indexed coin to withdraw
     * @return lpAmount Curve LP tokens required to remove the coin amounts
     */
    function _curveCalcWithdrawLpAmount(
        address _pool,
        uint256 _coinIndex,
        uint256 _assetAmount
    )
        internal
        view
        override(BaseCurveStrategy, CurveThreeCoin)
        returns (uint256 lpAmount)
    {
        lpAmount = _curveCalcWithdrawLpAmount(_pool, _coinIndex, _assetAmount);
    }

    /**
     * @notice Withdraws a single asset from the pool
     * @param _pool Address of the Curve pool
     * @param _amount The amount of underlying coin to withdraw
     * @param _coin_index Curve pool index of the coin to withdraw
     * @param _max_burn_amount Maximum amount of LP token to burn in the withdrawal
     * @param _asset The token address of the coin being withdrawn
     * @param _receiver Address that receives the withdrawn coins
     */
    function _curve_remove_liquidity_imbalance(
        address _pool,
        uint256 _amount,
        uint256 _coin_index,
        uint256 _max_burn_amount,
        address _asset,
        address _receiver
    ) internal override(BaseCurveStrategy, CurveThreeCoin) {
        _curve_remove_liquidity_imbalance(
            _pool,
            _amount,
            _coin_index,
            _max_burn_amount,
            _asset,
            _receiver
        );
    }

    /**
     * @notice Withdraw coins from the pool
     * @dev Withdrawal amounts are based on current deposit ratios
     * @param _pool Address of the Curve pool
     * @param _burn_amount Quantity of LP tokens to burn in the withdrawal
     * @param _min_amounts Minimum amounts of underlying coins to receive
     */
    function _curve_remove_liquidity(
        address _pool,
        uint256 _burn_amount,
        uint256[] memory _min_amounts
    ) internal override(BaseCurveStrategy, CurveThreeCoin) {
        _curve_remove_liquidity(_pool, _burn_amount, _min_amounts);
    }
}
