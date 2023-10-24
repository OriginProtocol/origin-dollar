// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { StableMath } from "../utils/StableMath.sol";
import { ICurvePool } from "./curve/ICurvePool.sol";
import { CurveThreeCoinLib } from "./curve/CurveThreeCoinLib.sol";
import { ConvexStrategy, BaseCurveStrategy } from "./ConvexStrategy.sol";

contract ThreePoolConvexStrategy is ConvexStrategy {
    constructor(
        BaseStrategyConfig memory _stratConfig,
        CurveConfig memory _curveConfig,
        ConvexConfig memory _convexConfig
    ) ConvexStrategy(_stratConfig, _curveConfig, _convexConfig) {}

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
    ) internal override {
        CurveThreeCoinLib.add_liquidity(_pool, _amounts, _min_mint_amount);
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
    ) internal view override returns (uint256 lpAmount) {
        lpAmount = CurveThreeCoinLib.calcWithdrawLpAmount(
            _pool,
            _coinIndex,
            _assetAmount
        );
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
    ) internal override {
        CurveThreeCoinLib.remove_liquidity_imbalance(
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
    ) internal override {
        CurveThreeCoinLib.remove_liquidity(_pool, _burn_amount, _min_amounts);
    }
}
