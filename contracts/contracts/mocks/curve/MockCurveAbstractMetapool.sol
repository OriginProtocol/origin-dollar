// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { MintableERC20, IMintableERC20 } from "../MintableERC20.sol";
import { StableMath } from "../../utils/StableMath.sol";
import "../../utils/Helpers.sol";

abstract contract MockCurveAbstractMetapool is MintableERC20 {
    using StableMath for uint256;

    address[] public coins;
    uint256[2] public balances;

    // Returns the same amount of LP tokens in 1e18 decimals
    function add_liquidity(uint256[2] calldata _amounts, uint256 _minAmount)
        external
        returns (uint256 lpAmount)
    {
        for (uint256 i = 0; i < _amounts.length; i++) {
            if (_amounts[i] > 0) {
                IERC20(coins[i]).transferFrom(
                    msg.sender,
                    address(this),
                    _amounts[i]
                );
                uint256 assetDecimals = Helpers.getDecimals(coins[i]);
                // Convert to 1e18 and add to sum
                lpAmount += _amounts[i].scaleBy(18, assetDecimals);
                balances[i] = balances[i] + _amounts[i];
            }
        }
        // Hacky way of simulating slippage to check _minAmount
        if (lpAmount == 29000e18) lpAmount = 14500e18;
        require(lpAmount >= _minAmount, "Slippage ruined your day");
        // Send LP token to sender, e.g. 3CRV
        _mint(msg.sender, lpAmount);
    }

    // Dumb implementation that returns the same amount
    function calc_withdraw_one_coin(uint256 _amount, int128 _index)
        public
        view
        returns (uint256 lpAmount)
    {
        uint256 assetDecimals = Helpers.getDecimals(coins[uint128(_index)]);
        lpAmount = _amount.scaleBy(assetDecimals, 18);
    }

    function remove_liquidity_one_coin(
        uint256 _lpAmount,
        int128 _index,
        // solhint-disable-next-line no-unused-vars
        uint256 _minAmount
    ) external returns (uint256 amount) {
        _burn(msg.sender, _lpAmount);
        uint256[] memory amounts = new uint256[](coins.length);
        amounts[uint128(_index)] = _lpAmount;
        amount = calc_withdraw_one_coin(_lpAmount, _index);
        balances[uint128(_index)] -= amount;
        IERC20(coins[uint128(_index)]).transfer(msg.sender, amount);
    }

    function get_virtual_price() external pure returns (uint256) {
        return 1e18;
    }

    // solhint-disable-next-line no-unused-vars
    function remove_liquidity(uint256 _amount, uint256[2] memory _min_amounts)
        public
        returns (uint256[2] memory amounts)
    {
        _burn(msg.sender, _amount);
        uint256 totalSupply = totalSupply();
        for (uint256 i = 0; i < 2; i++) {
            amounts[i] = totalSupply > 0
                ? (_amount * IERC20(coins[i]).balanceOf(address(this))) /
                    totalSupply
                : IERC20(coins[i]).balanceOf(address(this));
            balances[i] -= amounts[i];
            IERC20(coins[i]).transfer(msg.sender, amounts[i]);
        }
    }

    function remove_liquidity_imbalance(
        uint256[2] memory _amounts,
        uint256 _max_burned_tokens
    ) public returns (uint256) {
        return
            _remove_liquidity_imbalance(
                _amounts,
                _max_burned_tokens,
                msg.sender
            );
    }

    function remove_liquidity_imbalance(
        uint256[2] memory _amounts,
        uint256 _max_burned_tokens,
        address _reveiver
    ) public returns (uint256) {
        return
            _remove_liquidity_imbalance(
                _amounts,
                _max_burned_tokens,
                _reveiver
            );
    }

    function _remove_liquidity_imbalance(
        uint256[2] memory _amounts,
        uint256 _max_burned_tokens,
        address _reveiver
    ) internal returns (uint256 lpTokens) {
        lpTokens = _max_burned_tokens;
        _burn(msg.sender, lpTokens);
        for (uint256 i = 0; i < _amounts.length; i++) {
            balances[i] -= _amounts[i];
            if (_amounts[i] > 0) {
                IERC20(coins[i]).transfer(_reveiver, _amounts[i]);
            }
        }
    }

    // Dumb implementation that sums the scaled amounts
    function calc_token_amount(uint256[2] memory _amounts, bool)
        public
        view
        returns (uint256 lpTokens)
    {
        for (uint256 i = 0; i < _amounts.length; i++) {
            uint256 assetDecimals = Helpers.getDecimals(coins[i]);
            // Convert to 1e18 and add to lpTokens
            lpTokens += _amounts[i].scaleBy(18, assetDecimals);
        }
    }

    /// @notice 0.02% fee
    function fee() external pure returns (uint256) {
        return 2000000;
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function burnFrom(address from, uint256 value) public {
        _burn(from, value);
    }
}
