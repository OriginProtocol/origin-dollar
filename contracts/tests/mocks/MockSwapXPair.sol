// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockSwapXPair is MockERC20 {
    address public _token0;
    address public _token1;
    uint256 public _reserve0;
    uint256 public _reserve1;
    bool public _isStable;
    uint256 public _amountOutOverride;

    constructor(
        address token0_,
        address token1_
    ) MockERC20("SwapX LP", "sLP", 18) {
        _token0 = token0_;
        _token1 = token1_;
        _isStable = true;
    }

    // IPair interface functions:
    function token0() external view returns (address) {
        return _token0;
    }

    function token1() external view returns (address) {
        return _token1;
    }

    function isStable() external view returns (bool) {
        return _isStable;
    }

    function getReserves()
        external
        view
        returns (uint256, uint256, uint256)
    {
        return (_reserve0, _reserve1, block.timestamp);
    }

    function getAmountOut(
        uint256 amountIn,
        address tokenIn
    ) external view returns (uint256) {
        if (_amountOutOverride > 0) return _amountOutOverride;
        // Default ~1:1 stable pricing
        return amountIn;
    }

    // mint(address to) - SwapX style: reads balance delta above reserves,
    // mints LP proportionally
    function mint(address to) external returns (uint256 liquidity) {
        uint256 balance0 = IERC20(_token0).balanceOf(address(this));
        uint256 balance1 = IERC20(_token1).balanceOf(address(this));
        uint256 amount0 = balance0 - _reserve0;
        uint256 amount1 = balance1 - _reserve1;

        uint256 _totalSupply = totalSupply;
        if (_totalSupply == 0) {
            liquidity = amount0 + amount1; // Simple initial liquidity
        } else {
            // Proportional based on token0 contribution, same as real SwapX
            liquidity = (amount0 * _totalSupply) / _reserve0;
            uint256 liquidity1 = (amount1 * _totalSupply) / _reserve1;
            if (liquidity1 < liquidity) liquidity = liquidity1;
        }

        _mint(to, liquidity);
        _reserve0 = balance0;
        _reserve1 = balance1;
    }

    // burn(address to) - proportional removal
    function burn(
        address to
    ) external returns (uint256 amount0, uint256 amount1) {
        uint256 liquidity = balanceOf[address(this)];
        uint256 _totalSupply = totalSupply;

        amount0 = (liquidity * _reserve0) / _totalSupply;
        amount1 = (liquidity * _reserve1) / _totalSupply;

        _burn(address(this), liquidity);

        IERC20(_token0).transfer(to, amount0);
        IERC20(_token1).transfer(to, amount1);

        _reserve0 = IERC20(_token0).balanceOf(address(this));
        _reserve1 = IERC20(_token1).balanceOf(address(this));
    }

    // swap(amount0Out, amount1Out, to, data) - transfers out,
    // reads in via balance delta
    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address to,
        bytes calldata
    ) external {
        if (amount0Out > 0) IERC20(_token0).transfer(to, amount0Out);
        if (amount1Out > 0) IERC20(_token1).transfer(to, amount1Out);

        _reserve0 = IERC20(_token0).balanceOf(address(this));
        _reserve1 = IERC20(_token1).balanceOf(address(this));
    }

    // skim(address to) - transfer excess tokens above reserves
    function skim(address to) external {
        uint256 balance0 = IERC20(_token0).balanceOf(address(this));
        uint256 balance1 = IERC20(_token1).balanceOf(address(this));
        if (balance0 > _reserve0)
            IERC20(_token0).transfer(to, balance0 - _reserve0);
        if (balance1 > _reserve1)
            IERC20(_token1).transfer(to, balance1 - _reserve1);
    }

    // Test setters
    function setReserves(uint256 r0, uint256 r1) external {
        _reserve0 = r0;
        _reserve1 = r1;
    }

    function setAmountOut(uint256 amount) external {
        _amountOutOverride = amount;
    }

    function setStable(bool stable) external {
        _isStable = stable;
    }
}
