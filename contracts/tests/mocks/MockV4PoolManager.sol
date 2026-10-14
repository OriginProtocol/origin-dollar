// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPoolManager, IUnlockCallback, PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

/// @title MockV4PoolManager
/// @notice Just enough of the Uniswap v4 PoolManager for unit tests: a settable slot0 read
///         through `extsload`, an `unlock` that calls back and checks every delta is settled,
///         and a `swap` that returns a preset delta and moves the price to a preset value.
contract MockV4PoolManager {
    bytes32 internal constant POOLS_SLOT = bytes32(uint256(6));

    mapping(bytes32 => bytes32) internal slots;

    int128 public nextSwapAmount0;
    int128 public nextSwapAmount1;
    uint160 public nextSqrtPriceX96;

    IPoolManager.SwapParams public lastSwapParams;
    uint256 public swapCount;

    /// @dev Per currency, what the caller owes (negative) or is owed (positive).
    mapping(address => int256) public deltas;
    address[] internal touched;
    address internal syncedCurrency;
    uint256 internal syncedReserves;

    function setSqrtPrice(bytes32 poolId, uint160 sqrtPriceX96) external {
        slots[keccak256(abi.encode(poolId, POOLS_SLOT))] = bytes32(uint256(sqrtPriceX96));
    }

    /// @param amount0 Delta for the caller in currency0 (negative = caller pays).
    /// @param amount1 Delta for the caller in currency1 (positive = caller receives).
    /// @param sqrtPriceAfter Pool price once the swap is done.
    function setSwapResult(int128 amount0, int128 amount1, uint160 sqrtPriceAfter) external {
        nextSwapAmount0 = amount0;
        nextSwapAmount1 = amount1;
        nextSqrtPriceX96 = sqrtPriceAfter;
    }

    function extsload(bytes32 slot) external view returns (bytes32) {
        return slots[slot];
    }

    function unlock(bytes calldata data) external returns (bytes memory result) {
        result = IUnlockCallback(msg.sender).unlockCallback(data);
        for (uint256 i = 0; i < touched.length; i++) {
            require(deltas[touched[i]] == 0, "CurrencyNotSettled");
        }
        delete touched;
    }

    function swap(PoolKey memory key, IPoolManager.SwapParams memory params, bytes calldata)
        external
        returns (int256 swapDelta)
    {
        lastSwapParams = params;
        swapCount++;
        slots[keccak256(abi.encode(keccak256(abi.encode(key)), POOLS_SLOT))] = bytes32(uint256(nextSqrtPriceX96));

        _account(key.currency0, nextSwapAmount0);
        _account(key.currency1, nextSwapAmount1);

        swapDelta = (int256(nextSwapAmount0) << 128) | int256(uint256(uint128(nextSwapAmount1)));
    }

    function sync(address currency) external {
        syncedCurrency = currency;
        syncedReserves = IERC20(currency).balanceOf(address(this));
    }

    function settle() external payable returns (uint256 paid) {
        paid = IERC20(syncedCurrency).balanceOf(address(this)) - syncedReserves;
        deltas[syncedCurrency] += int256(paid);
        syncedCurrency = address(0);
    }

    function take(address currency, address to, uint256 amount) external {
        deltas[currency] -= int256(amount);
        require(IERC20(currency).transfer(to, amount), "Transfer failed");
    }

    function _account(address currency, int128 amount) internal {
        if (amount == 0) return;
        deltas[currency] += amount;
        touched.push(currency);
    }
}
