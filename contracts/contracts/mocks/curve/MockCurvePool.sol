// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IBurnableERC20 } from "../BurnableERC20.sol";

import { IMintableERC20 } from "../MintableERC20.sol";
import { ICurvePool } from "../../strategies/ICurvePool.sol";
import { StableMath } from "../../utils/StableMath.sol";
import "../../utils/Helpers.sol";

contract MockCurvePool {
    using StableMath for uint256;

    address[] public coins;
    uint256[3] public balances;
    address lpToken;
    uint256 public slippage = 1 ether;

    constructor(address[3] memory _coins, address _lpToken) {
        coins = _coins;
        lpToken = _lpToken;
    }

    function setCoins(address[] memory _coins) external {
        coins = _coins;
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
        // solhint-disable-next-line no-unused-vars
        uint256 _minAmount
    ) external {
        // Burn the Curve LP tokens
        IBurnableERC20(lpToken).burnFrom(msg.sender, _amount);
        uint256[] memory amounts = new uint256[](coins.length);
        amounts[uint128(_index)] = _amount;
        uint256 coinAmount = calc_withdraw_one_coin(_amount, _index);
        balances[uint128(_index)] -= coinAmount;
        IERC20(coins[uint128(_index)]).transfer(msg.sender, coinAmount);
    }

    function get_virtual_price() external pure returns (uint256) {
        return 1e18;
    }

    // solhint-disable-next-line no-unused-vars
    function remove_liquidity(uint256 _lpAmount, uint256[3] memory _min_amounts)
        public
    {
        // Burn the Curve LP tokens
        IBurnableERC20(lpToken).burnFrom(msg.sender, _lpAmount);
        uint256 totalSupply = IERC20(lpToken).totalSupply();
        for (uint256 i = 0; i < 3; i++) {
            uint256 coinAmount = totalSupply > 0
                ? (_lpAmount * IERC20(coins[i]).balanceOf(address(this))) /
                    totalSupply
                : IERC20(coins[i]).balanceOf(address(this));
            balances[i] -= coinAmount;
            IERC20(coins[i]).transfer(msg.sender, coinAmount);
        }
    }

    function remove_liquidity_imbalance(
        uint256[3] memory _amounts,
        uint256 _max_burned_tokens
    ) public {
        // Burn the Curve LP tokens
        IBurnableERC20(lpToken).burnFrom(msg.sender, _max_burned_tokens);
        // For each coin, transfer to the caller
        for (uint256 i = 0; i < _amounts.length; i++) {
            balances[i] -= _amounts[i];
            if (_amounts[i] > 0) {
                IERC20(coins[i]).transfer(msg.sender, _amounts[i]);
            }
        }
    }

    // Dumb implementation that sums the scaled amounts
    function calc_token_amount(uint256[3] memory _amounts, bool)
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

    function fee() external pure returns (uint256) {
        return 1000000;
    }

    function exchange(
        uint256 coin0,
        uint256 coin1,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut) {
        IERC20(coins[coin0]).transferFrom(msg.sender, address(this), amountIn);
        amountOut = (minAmountOut * slippage) / 1 ether;
        require(amountOut >= minAmountOut, "Slippage error");
        IMintableERC20(coins[coin1]).mintTo(msg.sender, amountOut);
    }

    function setSlippage(uint256 _slippage) external {
        slippage = _slippage;
    }
}
