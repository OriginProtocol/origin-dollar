// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICurvePool } from "./ICurvePool.sol";

library CurveThreeCoinLib {
    using SafeERC20 for IERC20;

    uint256 public constant CURVE_BASE_ASSETS = 3;

    /**
     * @notice Deposit coins into a Curve pool
     * @param _pool Address of the Curve pool
     * @param _amounts List of amounts of coins to deposit
     * @param _min_mint_amount Minimum amount of LP tokens to mint from the deposit
     */
    function add_liquidity(
        address _pool,
        uint256[] calldata _amounts,
        uint256 _min_mint_amount
    ) external {
        require(
            _amounts.length == CURVE_BASE_ASSETS,
            "Invalid number of amounts"
        );
        uint256[CURVE_BASE_ASSETS] memory amount = [
            _amounts[0],
            _amounts[1],
            _amounts[2]
        ];

        ICurvePool(_pool).add_liquidity(amount, _min_mint_amount);
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
        uint256[] calldata _min_amounts
    ) external {
        require(
            _min_amounts.length == CURVE_BASE_ASSETS,
            "Invalid number of min amounts"
        );
        uint256[CURVE_BASE_ASSETS] memory min_amounts = [
            _min_amounts[0],
            _min_amounts[1],
            _min_amounts[2]
        ];

        ICurvePool(_pool).remove_liquidity(_burn_amount, min_amounts);
    }

    /**
     * @notice Withdraw coins from the pool in an imbalanced amount
     * @param _pool Address of the Curve pool
     * @param _amounts List of amounts of underlying coins to withdraw
     * @param _max_burn_amount Maximum amount of LP token to burn in the withdrawal
     */
    function remove_liquidity_imbalance(
        address _pool,
        uint256[] calldata _amounts,
        uint256 _max_burn_amount
    ) external {
        require(
            _amounts.length == CURVE_BASE_ASSETS,
            "Invalid number of amounts"
        );
        uint256[CURVE_BASE_ASSETS] memory amounts = [
            _amounts[0],
            _amounts[1],
            _amounts[2]
        ];

        ICurvePool(_pool).remove_liquidity_imbalance(amounts, _max_burn_amount);
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
    function remove_liquidity_imbalance(
        address _pool,
        uint256 _amount,
        uint256 _coin_index,
        uint256 _max_burn_amount,
        address _asset,
        address _receiver
    ) external {
        uint256[CURVE_BASE_ASSETS] memory amounts = [uint256(0), 0, 0];
        amounts[_coin_index] = _amount;

        ICurvePool(_pool).remove_liquidity_imbalance(amounts, _max_burn_amount);

        IERC20(_asset).safeTransfer(_receiver, _amount);
    }

    /**
     * @notice Calculate addition or reduction in token supply from a deposit or withdrawal
     * @dev This calculation accounts for slippage, but not fees.
     * Needed to prevent front-running, not for precise calculations!
     * @param _pool Address of the Curve pool
     * @param _amounts Amount of each coin being deposited
     * @param _is_deposit set True for deposits, False for withdrawals
     * @return lpTokens Expected amount of LP tokens received
     */
    function calc_token_amount(
        address _pool,
        uint256[] calldata _amounts,
        bool _is_deposit
    ) external view returns (uint256 lpTokens) {
        require(
            _amounts.length == CURVE_BASE_ASSETS,
            "Invalid number of amounts"
        );
        uint256[CURVE_BASE_ASSETS] memory amounts = [
            _amounts[0],
            _amounts[1],
            _amounts[2]
        ];

        lpTokens = ICurvePool(_pool).calc_token_amount(amounts, _is_deposit);
    }
}
