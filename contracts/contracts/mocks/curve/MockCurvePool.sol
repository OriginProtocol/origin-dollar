// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IMintableERC20 } from "../MintableERC20.sol";
import { ICurvePool } from "../../strategies/ICurvePool.sol";
import { StableMath } from "../../utils/StableMath.sol";
import "../../utils/Helpers.sol";

contract MockCurvePool {
    using StableMath for uint256;

    address[] public coins;
    uint256[3] public balances;
    address lpToken;

    constructor(address[3] memory _coins, address _lpToken) {
        coins = _coins;
        lpToken = _lpToken;
    }

    // Returns the same amount of LP tokens in 1e18 decimals
    function add_liquidity(uint256[3] calldata _amounts, uint256 _minAmount)
        external
    {
        uint256 sum = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            if (_amounts[i] > 0) {
                IERC20(coins[i]).transferFrom(
                    msg.sender,
                    address(this),
                    _amounts[i]
                );
                uint256 assetDecimals = Helpers.getDecimals(coins[i]);
                // Convert to 1e18 and add to sum
                sum += _amounts[i].scaleBy(18, assetDecimals);
                balances[i] = balances[i] + _amounts[i];
            }
        }
        // Hacky way of simulating slippage to check _minAmount
        if (sum == 29000e18) sum = 14500e18;
        require(sum >= _minAmount, "Slippage ruined your day");
        // Send LP token to sender, e.g. 3CRV
        IMintableERC20(lpToken).mint(sum);
        IERC20(lpToken).transfer(msg.sender, sum);
    }

    // Dumb implementation that returns the same amount
    function calc_withdraw_one_coin(uint256 _amount, int128 _index)
        public
        view
        returns (uint256)
    {
        uint256 assetDecimals = Helpers.getDecimals(coins[uint128(_index)]);
        return _amount.scaleBy(assetDecimals, 18);
    }

    function remove_liquidity_one_coin(
        uint256 _amount,
        int128 _index,
        uint256 _minAmount
    ) external {
        IERC20(lpToken).transferFrom(msg.sender, address(this), _amount);
        uint256[] memory amounts = new uint256[](coins.length);
        amounts[uint128(_index)] = _amount;
        uint256 amount = calc_withdraw_one_coin(_amount, _index);
        IERC20(coins[uint128(_index)]).transfer(msg.sender, amount);
        balances[uint128(_index)] = balances[uint128(_index)] - amount;
    }

    function get_virtual_price() external pure returns (uint256) {
        return 1 * 10**18;
    }

    function remove_liquidity(uint256 _amount, uint256[3] memory _min_amounts)
        public
    {
        IERC20(lpToken).transferFrom(msg.sender, address(this), _amount);
        uint256 totalSupply = IERC20(lpToken).totalSupply();
        for (uint256 i = 0; i < 3; i++) {
            uint256 amount = (_amount / totalSupply) *
                IERC20(coins[i]).balanceOf(address(this));
            IERC20(coins[i]).transfer(msg.sender, amount);
            balances[i] = balances[i] - amount;
        }
    }

    function remove_liquidity_imbalance(
        uint256[3] memory _amounts,
        uint256 _max_burned_tokens
    ) public {
        IERC20(lpToken).transferFrom(
            msg.sender,
            address(this),
            _max_burned_tokens
        );
        for (uint256 i = 0; i < _amounts.length; i++) {
            IERC20(coins[i]).transfer(msg.sender, _amounts[i]);
            balances[i] = balances[i] - _amounts[i];
        }
    }
}
