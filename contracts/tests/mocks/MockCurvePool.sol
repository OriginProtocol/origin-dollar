// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title MockCurvePool
/// @notice Serves as both the Curve StableSwap NG pool and its LP token.
///         Stateful: tracks pool balances so `improvePoolBalance` works correctly.
contract MockCurvePool is MockERC20 {
    address[2] public _coins;
    uint256[2] public _balances;
    uint256 public _virtualPrice;
    /// @notice Simulates LP slippage: reduce minted LP by this bps (10000 = 100%)
    uint256 public _slippageBps;

    constructor(address coin0, address coin1) MockERC20("Curve LP", "crvLP", 18) {
        _coins[0] = coin0;
        _coins[1] = coin1;
        _virtualPrice = 1e18;
    }

    // --- Curve interface functions ---

    function coins(uint256 i) external view returns (address) {
        return _coins[i];
    }

    function get_balances() external view returns (uint256[] memory bals) {
        bals = new uint256[](2);
        bals[0] = _balances[0];
        bals[1] = _balances[1];
    }

    function balances(uint256 i) external view returns (uint256) {
        return _balances[i];
    }

    function get_virtual_price() external view returns (uint256) {
        return _virtualPrice;
    }

    function add_liquidity(
        uint256[] memory amounts,
        uint256 /* minMintAmount */
    )
        external
        returns (uint256 lpMinted)
    {
        // Transfer tokens in
        if (amounts[0] > 0) {
            IERC20(_coins[0]).transferFrom(msg.sender, address(this), amounts[0]);
            _balances[0] += amounts[0];
        }
        if (amounts[1] > 0) {
            IERC20(_coins[1]).transferFrom(msg.sender, address(this), amounts[1]);
            _balances[1] += amounts[1];
        }

        // Simple LP calculation: sum of amounts scaled by virtual price
        lpMinted = ((amounts[0] + amounts[1]) * 1e18) / _virtualPrice;
        // Apply simulated slippage
        if (_slippageBps > 0) {
            lpMinted = (lpMinted * (10000 - _slippageBps)) / 10000;
        }
        _mint(msg.sender, lpMinted);
    }

    function remove_liquidity(
        uint256 burnAmount,
        uint256[] memory /* minAmounts */
    )
        external
        returns (uint256[] memory received)
    {
        received = new uint256[](2);
        uint256 supply = totalSupply;
        if (supply == 0) return received;

        // Proportional removal
        received[0] = (_balances[0] * burnAmount) / supply;
        received[1] = (_balances[1] * burnAmount) / supply;

        _burn(msg.sender, burnAmount);

        _balances[0] -= received[0];
        _balances[1] -= received[1];

        IERC20(_coins[0]).transfer(msg.sender, received[0]);
        IERC20(_coins[1]).transfer(msg.sender, received[1]);
    }

    function remove_liquidity_one_coin(
        uint256 burnAmount,
        int128 i,
        uint256,
        /* minReceived */
        address receiver
    )
        external
        returns (uint256 received)
    {
        uint256 idx = uint128(i);
        // Simple: value of LP in terms of single coin using virtual price
        received = (burnAmount * _virtualPrice) / 1e18;

        _burn(msg.sender, burnAmount);
        _balances[idx] -= received;
        IERC20(_coins[idx]).transfer(receiver, received);
    }

    // --- Swap function ---

    function exchange(int128 i, int128 j, uint256 dx, uint256 minDy) external returns (uint256 dy) {
        uint256 idxIn = uint128(i);
        uint256 idxOut = uint128(j);

        // Simple 1:1 swap for stableswap mock
        dy = dx;
        require(dy >= minDy, "Slippage");

        IERC20(_coins[idxIn]).transferFrom(msg.sender, address(this), dx);
        _balances[idxIn] += dx;

        _balances[idxOut] -= dy;
        IERC20(_coins[idxOut]).transfer(msg.sender, dy);
    }

    // --- Setters for test configuration ---

    function setVirtualPrice(uint256 vp) external {
        _virtualPrice = vp;
    }

    function setBalances(uint256 bal0, uint256 bal1) external {
        _balances[0] = bal0;
        _balances[1] = bal1;
    }

    function setSlippageBps(uint256 bps) external {
        _slippageBps = bps;
    }
}
