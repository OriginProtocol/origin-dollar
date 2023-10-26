// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ICurveMetaPool } from "./ICurveMetaPool.sol";
import { StableMath } from "../../utils/StableMath.sol";

library CurveTwoCoinLib {
    uint256 public constant CURVE_POOL_ASSETS_COUNT = 2;
    using StableMath for uint256;

    /**
     * @notice Deposit coins into a Curve pool
     * @param _pool Address of the Curve pool
     * @param _amounts List of amounts of coins to deposit
     * @param _min_mint_amount Minimum amount of LP tokens to mint from the deposit
     */
    function add_liquidity(
        address _pool,
        uint256[] memory _amounts,
        uint256 _min_mint_amount
    ) internal {
        require(
            _amounts.length == CURVE_POOL_ASSETS_COUNT,
            "Invalid number of amounts"
        );
        uint256[CURVE_POOL_ASSETS_COUNT] memory amounts = [
            _amounts[0],
            _amounts[1]
        ];

        // slither-disable-next-line unused-return
        ICurveMetaPool(_pool).add_liquidity(amounts, _min_mint_amount);
    }

    /**
     * @notice Withdraw coins from the pool
     * @dev Withdrawal amounts are based on current deposit ratios
     * @param _pool Address of the Curve pool
     * @param _burn_amount Quantity of LP tokens to burn in the withdrawal
     * @param _min_amounts Minimum amounts of underlying coins to receive
     */
    function remove_liquidity(
        address _pool,
        uint256 _burn_amount,
        uint256[] memory _min_amounts
    ) internal {
        require(
            _min_amounts.length == CURVE_POOL_ASSETS_COUNT,
            "Invalid number of min amounts"
        );
        uint256[CURVE_POOL_ASSETS_COUNT] memory min_amounts = [
            _min_amounts[0],
            _min_amounts[1]
        ];

        // slither-disable-next-line unused-return
        ICurveMetaPool(_pool).remove_liquidity(_burn_amount, min_amounts);
    }

    /**
     * @notice Withdraw coins from the pool
     * @dev Withdrawal amounts are based on current deposit ratios
     * @param _pool Address of the Curve pool
     * @param _burn_amount Quantity of LP tokens to burn in the withdrawal
     * @param _min_amounts Minimum amounts of underlying coins to receive
     * @param _receiver Address that receives the withdrawn coins
     */
    function remove_liquidity(
        address _pool,
        uint256 _burn_amount,
        uint256[] memory _min_amounts,
        address _receiver
    ) internal {
        require(
            _min_amounts.length == CURVE_POOL_ASSETS_COUNT,
            "Invalid number of min amounts"
        );
        uint256[CURVE_POOL_ASSETS_COUNT] memory min_amounts = [
            _min_amounts[0],
            _min_amounts[1]
        ];

        // slither-disable-next-line unused-return
        ICurveMetaPool(_pool).remove_liquidity(
            _burn_amount,
            min_amounts,
            _receiver
        );
    }

    /**
     * @notice Withdraw coins from the pool in an imbalanced amount
     * @param _pool Address of the Curve pool
     * @param _amounts List of amounts of underlying coins to withdraw
     * @param _max_burn_amount Maximum amount of LP token to burn in the withdrawal
     */
    function remove_liquidity_imbalance(
        address _pool,
        uint256[] memory _amounts,
        uint256 _max_burn_amount
    ) internal {
        require(
            _amounts.length == CURVE_POOL_ASSETS_COUNT,
            "Invalid number of amounts"
        );
        uint256[CURVE_POOL_ASSETS_COUNT] memory amounts = [
            _amounts[0],
            _amounts[1]
        ];

        // slither-disable-next-line unused-return
        ICurveMetaPool(_pool).remove_liquidity_imbalance(
            amounts,
            _max_burn_amount
        );
    }

    /**
     * @notice Withdraw coins from the pool in an imbalanced amount
     * @param _pool Address of the Curve pool
     * @param _amount The amount of underlying coin to withdraw
     * @param _coin_index Curve pool index of the coin to withdraw
     * @param _max_burn_amount Maximum amount of LP token to burn in the withdrawal
     * param _asset is not used in this implementation but is in the CurveThreeCoinLib implementation
     * @param _receiver Address that receives the withdrawn coins
     */
    function remove_liquidity_imbalance(
        address _pool,
        uint256 _amount,
        uint256 _coin_index,
        uint256 _max_burn_amount,
        address,
        address _receiver
    ) internal {
        uint256[CURVE_POOL_ASSETS_COUNT] memory amounts = [uint256(0), 0];
        amounts[_coin_index] = _amount;

        // slither-disable-next-line unused-return
        ICurveMetaPool(_pool).remove_liquidity_imbalance(
            amounts,
            _max_burn_amount,
            _receiver
        );
    }

    /**
     * @notice Calculate addition or reduction in token supply from a deposit or withdrawal
     * @dev This calculation accounts for slippage, but not fees.
     * Needed to prevent front-running, not for precise calculations!
     * @param _pool Address of the Curve pool
     * @param _amounts Amount of each coin being deposited or withdrawn
     * @param _is_deposit set True for deposits, False for withdrawals
     * @return lpTokens Expected amount of LP tokens received
     */
    function calc_token_amount(
        address _pool,
        uint256[] memory _amounts,
        bool _is_deposit
    ) internal view returns (uint256 lpTokens) {
        require(
            _amounts.length == CURVE_POOL_ASSETS_COUNT,
            "Invalid number of amounts"
        );
        uint256[CURVE_POOL_ASSETS_COUNT] memory amounts = [
            _amounts[0],
            _amounts[1]
        ];

        lpTokens = ICurveMetaPool(_pool).calc_token_amount(
            amounts,
            _is_deposit
        );
    }

    /**
     * @notice Calculate amount of LP required when withdrawing specific amount of one
     * of the underlying assets accounting for fees and slippage.
     *
     * This implementation assumes a newer Curve pool is used which includes fees in the
     * calc_token_amount functinon.
     *
     * @param _pool Address of the Curve pool
     * @param _coinIndex index of the coin in the Curve pool that is to be withdrawn
     * @param _assetAmount Amount of of the indexed coin to withdraw
     * @return lpAmount Curve LP tokens required to remove the coin amounts
     */
    function calcWithdrawLpAmount(
        address _pool,
        uint256 _coinIndex,
        uint256 _assetAmount
    ) internal view returns (uint256 lpAmount) {
        uint256[CURVE_POOL_ASSETS_COUNT] memory amounts = [uint256(0), 0];
        amounts[_coinIndex] = _assetAmount;

        // LP required when removing required asset including slippage and fees.
        // Need to add 1 to account for rounding up in the remove_liquidity_imbalance implementation.
        lpAmount = ICurveMetaPool(_pool).calc_token_amount(amounts, false) + 1;
    }
}
