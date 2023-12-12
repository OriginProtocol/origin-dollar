// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ICurveMetaPool } from "./ICurveMetaPool.sol";
import { StableMath } from "../../utils/StableMath.sol";
import { CurveFunctions } from "../BaseCurveStrategy.sol";

contract CurveTwoCoinFunctions {
    using StableMath for uint256;

    uint256 public constant COIN_COUNT = 2;

    address internal immutable _CURVE_POOL;

    constructor(address _curvePool) {
        _CURVE_POOL = _curvePool;
    }

    function getCurveFunctions()
        internal
        pure
        virtual
        returns (CurveFunctions memory)
    {
        return
            CurveFunctions({
                add_liquidity: add_liquidity,
                remove_liquidity: remove_liquidity,
                remove_liquidity_imbalance: remove_liquidity_imbalance,
                calcWithdrawLpAmount: calcWithdrawLpAmount
            });
    }

    /**
     * @notice Deposit coins into a Curve pool
     * @param _amounts List of amounts of coins to deposit
     * @param _min_mint_amount Minimum amount of LP tokens to mint from the deposit
     */
    function add_liquidity(uint256[] memory _amounts, uint256 _min_mint_amount)
        internal
    {
        require(_amounts.length == COIN_COUNT, "Invalid number of amounts");
        uint256[COIN_COUNT] memory amounts = [_amounts[0], _amounts[1]];

        // slither-disable-next-line unused-return
        ICurveMetaPool(_CURVE_POOL).add_liquidity(amounts, _min_mint_amount);
    }

    /**
     * @notice Withdraw coins from the pool
     * @dev Withdrawal amounts are based on current deposit ratios
     * @param _burn_amount Quantity of LP tokens to burn in the withdrawal
     * @param _min_amounts Minimum amounts of underlying coins to receive
     */
    function remove_liquidity(
        uint256 _burn_amount,
        uint256[] memory _min_amounts
    ) internal {
        require(
            _min_amounts.length == COIN_COUNT,
            "Invalid number of min amounts"
        );
        uint256[COIN_COUNT] memory min_amounts = [
            _min_amounts[0],
            _min_amounts[1]
        ];

        // slither-disable-next-line unused-return
        ICurveMetaPool(_CURVE_POOL).remove_liquidity(_burn_amount, min_amounts);
    }

    /**
     * @notice Withdraw coins from the pool in an imbalanced amount
     * @param _amount The amount of underlying coin to withdraw
     * @param _coin_index Curve pool index of the coin to withdraw
     * @param _max_burn_amount Maximum amount of LP token to burn in the withdrawal
     * param _asset is not used in this implementation but is in the CurveThreeCoinLib implementation
     * @param _receiver Address that receives the withdrawn coins
     */
    function remove_liquidity_imbalance(
        uint256 _amount,
        uint256 _coin_index,
        uint256 _max_burn_amount,
        address,
        address _receiver
    ) internal {
        uint256[COIN_COUNT] memory amounts = [uint256(0), 0];
        amounts[_coin_index] = _amount;

        // slither-disable-next-line unused-return
        ICurveMetaPool(_CURVE_POOL).remove_liquidity_imbalance(
            amounts,
            _max_burn_amount,
            _receiver
        );
    }

    /**
     * @notice Calculate amount of LP required when withdrawing specific amount of one
     * of the underlying assets accounting for fees and slippage.
     *
     * This implementation assumes a newer Curve pool is used which includes fees in the
     * calc_token_amount functinon.
     *
     * @param _coinIndex index of the coin in the Curve pool that is to be withdrawn
     * @param _assetAmount Amount of of the indexed coin to withdraw
     * @return lpAmount Curve LP tokens required to remove the coin amounts
     */
    function calcWithdrawLpAmount(uint256 _coinIndex, uint256 _assetAmount)
        public
        view
        returns (uint256 lpAmount)
    {
        uint256[COIN_COUNT] memory amounts = [uint256(0), 0];
        amounts[_coinIndex] = _assetAmount;

        // LP required when removing required asset including slippage and fees.
        // Need to add 1 to account for rounding up in the remove_liquidity_imbalance implementation.
        lpAmount =
            ICurveMetaPool(_CURVE_POOL).calc_token_amount(amounts, false) +
            1;
    }
}
