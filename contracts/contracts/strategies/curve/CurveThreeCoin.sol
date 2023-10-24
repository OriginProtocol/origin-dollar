// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { StableMath } from "../../utils/StableMath.sol";
import { ICurvePool } from "./ICurvePool.sol";

contract CurveThreeCoin {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    /**
     * @notice Deposit coins into a Curve pool
     * @param _pool Address of the Curve pool
     * @param _amounts List of amounts of coins to deposit
     * @param _min_mint_amount Minimum amount of LP tokens to mint from the deposit
     */
    function _curve_add_liquidity(
        address _pool,
        uint256[] calldata _amounts,
        uint256 _min_mint_amount
    ) internal virtual {
        require(_amounts.length == 3, "Invalid number of amounts");
        uint256[3] memory amounts = [_amounts[0], _amounts[1], _amounts[2]];

        ICurvePool(_pool).add_liquidity(amounts, _min_mint_amount);
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
        uint256[] calldata _min_amounts
    ) internal virtual {
        require(_min_amounts.length == 3, "Invalid number of min amounts");
        uint256[3] memory min_amounts = [
            _min_amounts[0],
            _min_amounts[1],
            _min_amounts[2]
        ];

        ICurvePool(_pool).remove_liquidity(_burn_amount, min_amounts);
    }

    /**
     * @notice Withdraw coins from the pool in an imbalanced amount
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
    ) internal virtual {
        uint256[3] memory amounts = [uint256(0), 0, 0];
        amounts[_coin_index] = _amount;

        ICurvePool(_pool).remove_liquidity_imbalance(amounts, _max_burn_amount);

        IERC20(_asset).safeTransfer(_receiver, _amount);
    }

    /**
     * @notice Calculate amount of LP required when withdrawing specific amount of one
     * of the underlying assets accounting for fees and slippage.
     *
     * Older Curve pools unfortunately do not contain a calculation function for
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
     *  - the required amount of Curve LP tokens including fees is calculated by reducing the full fee LP amount
     *    by the ratio of required assets to assets received for full fee LP amount.
     * @param _pool Address of the Curve pool
     * @param _coinIndex index of the coin in the Curve pool that is to be withdrawn
     * @param _assetAmount Amount of of the indexed coin to withdraw
     * @return lpAmount Curve LP tokens required to remove the coin amounts
     */
    function _curveCalcWithdrawLpAmount(
        address _pool,
        uint256 _coinIndex,
        uint256 _assetAmount
    ) internal view virtual returns (uint256 lpAmount) {
        uint256[3] memory amounts = [uint256(0), 0, 0];
        amounts[_coinIndex] = _assetAmount;

        // LP required when removing required asset including slippage but ignoring fees
        uint256 lpRequiredNoFees = ICurvePool(_pool).calc_token_amount(
            amounts,
            false
        );
        /* LP required if fees would apply to entirety of removed amount
         *
         * fee is 1e10 denominated number: https://curve.readthedocs.io/exchange-pools.html#StableSwap.fee
         */
        uint256 lpRequiredFullFees = lpRequiredNoFees.mulTruncateScale(
            1e10 + ICurvePool(_pool).fee(),
            1e10
        );

        /* Asset received when withdrawing full fee applicable LP accounting for slippage and fees.
         * Unlike calc_token_amount which does not include fees, calc_withdraw_one_coin includes fees.
         */
        uint256 assetReceivedForFullLPFees = ICurvePool(_pool)
            .calc_withdraw_one_coin(
                lpRequiredFullFees,
                int128(uint128(_coinIndex))
            );

        // The required amount of Curve LP tokens including fees is calculated by reducing the full fee LP amount
        // by the ratio of required assets to assets received from the full fee LP amount.
        // required LP tokens = full fee LP tokens * (required asset amount / asset received for full fee LP tokens)
        lpAmount =
            (lpRequiredFullFees * _assetAmount) /
            assetReceivedForFullLPFees;
    }
}
