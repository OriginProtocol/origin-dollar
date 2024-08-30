// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

import { IAMOStrategy } from "../interfaces/aerodrome/IAMOStrategy.sol";

contract QuoterHelper {
    ////////////////////////////////////////////////////////////////
    /// --- STRUCTS & ENUMS
    ////////////////////////////////////////////////////////////////
    enum RevertReasons {
        DefaultStatus,
        RebalanceOutOfBounds,
        NotInExpectedTickRange,
        NotEnoughWethForSwap,
        NotEnoughWethLiquidity,
        UnexpectedError,
        Found,
        NotFound
    }

    struct RebalanceStatus {
        RevertReasons reason;
        uint256 currentPoolWETHShare; // Case 1
        uint256 allowedWETHShareStart; // Case 1
        uint256 allowedWETHShareEnd; // Case 1
        int24 currentTick; // Case 2
        uint256 balanceWETH; // Case 3
        uint256 amountWETH; // Case 3
        string revertMessage;
    }

    ////////////////////////////////////////////////////////////////
    /// --- CONSTANT & IMMUTABLE
    ////////////////////////////////////////////////////////////////
    uint256 public constant BINARY_MIN_AMOUNT = 0.000_000_01 ether;
    uint256 public constant BINARY_MAX_AMOUNT = 1_000 ether;
    uint256 public constant BINARY_MAX_ITERATIONS = 50;

    ////////////////////////////////////////////////////////////////
    /// --- VARIABLES STORAGE
    ////////////////////////////////////////////////////////////////
    IAMOStrategy public strategy;

    ////////////////////////////////////////////////////////////////
    /// --- ERRORS & EVENTS
    ////////////////////////////////////////////////////////////////
    error UnexpectedError(string message);
    error OutOfIterations(uint256 iterations);
    error ValidAmount(
        uint256 amount,
        uint256 iterations,
        bool swapWETHForOETHB
    );

    ////////////////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    ////////////////////////////////////////////////////////////////
    constructor(IAMOStrategy _strategy) {
        strategy = _strategy;
    }

    ////////////////////////////////////////////////////////////////
    /// --- FUNCTIONS
    ////////////////////////////////////////////////////////////////
    /// @notice This call can only end with a revert.
    function getAmountToSwapBeforeRebalance() public {
        uint256 iterations;
        uint256 low = BINARY_MIN_AMOUNT;
        uint256 high = BINARY_MAX_AMOUNT;
        int24 lowerTick = strategy.lowerTick();
        int24 upperTick = strategy.upperTick();
        bool swapWETHForOETHB = getSwapDirection();

        while (low <= high && iterations < BINARY_MAX_ITERATIONS) {
            uint256 mid = (low + high) / 2;

            RebalanceStatus memory status = getRebalanceStatus(
                mid,
                swapWETHForOETHB
            );

            // Best case, we found the `amount` that will reach the target pool share!
            // We can revert with the amount and the number of iterations
            if (status.reason == RevertReasons.Found) {
                revert ValidAmount(mid, iterations, swapWETHForOETHB);
            }

            // If the rebalance failed then we should try to change the amount.
            // We will handle all possible revert reasons here.

            // Case 1: Rebalance out of bounds
            // If the pool is out of bounds, we need to adjust the amount to reach the target pool share
            if (status.reason == RevertReasons.RebalanceOutOfBounds) {
                // If the current pool share is less than the target pool share, we need to increase the amount
                if (
                    swapWETHForOETHB
                        ? status.currentPoolWETHShare <
                            status.allowedWETHShareStart
                        : status.currentPoolWETHShare >
                            status.allowedWETHShareEnd
                ) {
                    low = mid + 1;
                }
                // Else we need to decrease the amount
                else {
                    high = mid;
                }
            }

            // Case 2: Not in expected tick range
            // If the pool is not in the expected tick range, we need to adjust the amount
            // to reach the target pool share
            if (status.reason == RevertReasons.NotInExpectedTickRange) {
                // If we are buying OETHb and the current tick is greater than the lower tick,
                //we need to increase the amount in order to continue to push price down.
                // If we are selling OETHb and the current tick is less than the upper tick,
                // we need to increase the amount in order to continue to push price up.
                if (
                    swapWETHForOETHB
                        ? status.currentTick > lowerTick
                        : status.currentTick < upperTick
                ) {
                    low = mid + 1;
                }
                // Else we need to decrease the amount
                else {
                    high = mid;
                }
            }

            // Case 3: Not enough WETH for swap
            // If we don't have enough WETH to swap, we need to decrease the amount
            // This error can happen, when initial value of mid is too high, so we need to decrease it
            if (status.reason == RevertReasons.NotEnoughWethForSwap) {
                high = mid;
            }

            // Case 4: Not enough WETH liquidity
            // If we don't have enough WETH liquidity
            // Revert for the moment, we need to improve this
            if (status.reason == RevertReasons.NotEnoughWethLiquidity) {
                revert("Quoter: Not enough WETH liquidity");
            }

            // Case 5: Unexpected error
            // Worst case, it reverted with an unexpected error.
            if (status.reason == RevertReasons.UnexpectedError) {
                revert UnexpectedError(status.revertMessage);
            }

            iterations++;
        }

        // Case 6: Out of iterations
        // If we didn't find the amount after the max iterations, we need to revert.
        revert OutOfIterations(iterations);
    }

    function getRebalanceStatus(uint256 amount, bool swapWETH)
        public
        returns (RebalanceStatus memory status)
    {
        try strategy.rebalance(amount, swapWETH, 0) {
            status.reason = RevertReasons.Found;
            return status;
        } catch Error(string memory reason) {
            status.reason = RevertReasons.UnexpectedError;
            status.revertMessage = reason;
        } catch (bytes memory reason) {
            bytes4 receivedSelector = bytes4(reason);

            // Case 1: Rebalance out of bounds
            if (
                receivedSelector ==
                IAMOStrategy.PoolRebalanceOutOfBounds.selector
            ) {
                uint256 currentPoolWETHShare;
                uint256 allowedWETHShareStart;
                uint256 allowedWETHShareEnd;

                // solhint-disable-next-line no-inline-assembly
                assembly {
                    currentPoolWETHShare := mload(add(reason, 0x24))
                    allowedWETHShareStart := mload(add(reason, 0x44))
                    allowedWETHShareEnd := mload(add(reason, 0x64))
                }
                return
                    RebalanceStatus({
                        reason: RevertReasons.RebalanceOutOfBounds,
                        currentPoolWETHShare: currentPoolWETHShare,
                        allowedWETHShareStart: allowedWETHShareStart,
                        allowedWETHShareEnd: allowedWETHShareEnd,
                        currentTick: 0,
                        balanceWETH: 0,
                        amountWETH: 0,
                        revertMessage: ""
                    });
            }

            // Case 2: Not in expected tick range
            if (
                receivedSelector ==
                IAMOStrategy.OutsideExpectedTickRange.selector
            ) {
                int24 currentTick;

                // solhint-disable-next-line no-inline-assembly
                assembly {
                    currentTick := mload(add(reason, 0x24))
                }
                return
                    RebalanceStatus({
                        reason: RevertReasons.NotInExpectedTickRange,
                        currentPoolWETHShare: 0,
                        allowedWETHShareStart: 0,
                        allowedWETHShareEnd: 0,
                        currentTick: currentTick,
                        balanceWETH: 0,
                        amountWETH: 0,
                        revertMessage: ""
                    });
            }

            // Case 3: Not enough WETH for swap
            if (
                receivedSelector == IAMOStrategy.NotEnoughWethForSwap.selector
            ) {
                uint256 balanceWETH;
                uint256 amountWETH;

                // solhint-disable-next-line no-inline-assembly
                assembly {
                    balanceWETH := mload(add(reason, 0x24))
                    amountWETH := mload(add(reason, 0x44))
                }
                return
                    RebalanceStatus({
                        reason: RevertReasons.NotEnoughWethForSwap,
                        currentPoolWETHShare: 0,
                        allowedWETHShareStart: 0,
                        allowedWETHShareEnd: 0,
                        currentTick: 0,
                        balanceWETH: balanceWETH,
                        amountWETH: amountWETH,
                        revertMessage: ""
                    });
            }

            // Case 4: Not enough WETH liquidity
            if (
                receivedSelector == IAMOStrategy.NotEnoughWethLiquidity.selector
            ) {
                return
                    RebalanceStatus({
                        reason: RevertReasons.NotEnoughWethLiquidity,
                        currentPoolWETHShare: 0,
                        allowedWETHShareStart: 0,
                        allowedWETHShareEnd: 0,
                        currentTick: 0,
                        balanceWETH: 0,
                        amountWETH: 0,
                        revertMessage: ""
                    });
            }

            // Case 5: Unexpected error
            return
                RebalanceStatus({
                    reason: RevertReasons.UnexpectedError,
                    currentPoolWETHShare: 0,
                    allowedWETHShareStart: 0,
                    allowedWETHShareEnd: 0,
                    currentTick: 0,
                    balanceWETH: 0,
                    amountWETH: 0,
                    revertMessage: abi.decode(reason, (string))
                });
        }
    }

    function getSwapDirection() public view returns (bool) {
        uint160 currentPrice = strategy.getPoolX96Price();
        uint160 ticker0Price = strategy.sqrtRatioX96TickLower();
        uint160 ticker1Price = strategy.sqrtRatioX96TickHigher();
        uint160 targetPrice = (ticker0Price * 20 + ticker1Price * 80) / 100;

        return currentPrice > targetPrice;
    }
}

contract AerodromeAMOQuoter {
    ////////////////////////////////////////////////////////////////
    /// --- STRUCTS & ENUMS
    ///////////////////////////////////////////////////////////////
    struct Data {
        uint256 amount;
        uint256 iterations;
    }

    ////////////////////////////////////////////////////////////////
    /// --- VARIABLES STORAGE
    ////////////////////////////////////////////////////////////////
    QuoterHelper public quoterHelper;

    ////////////////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    ////////////////////////////////////////////////////////////////
    constructor(address _strategy) {
        quoterHelper = new QuoterHelper(IAMOStrategy(_strategy));
    }

    ////////////////////////////////////////////////////////////////
    /// --- ERRORS & EVENTS
    ////////////////////////////////////////////////////////////////
    event ValueFound(uint256 value, uint256 iterations, bool swapWETHForOETHB);
    event ValueNotFound(string message);

    ////////////////////////////////////////////////////////////////
    /// --- FUNCTIONS
    ////////////////////////////////////////////////////////////////
    function quoteAmountToSwapBeforeRebalance()
        public
        returns (Data memory data)
    {
        try quoterHelper.getAmountToSwapBeforeRebalance() {
            revert("Previous call should only revert, it cannot succeed");
        } catch (bytes memory reason) {
            bytes4 receivedSelector = bytes4(reason);

            if (receivedSelector == QuoterHelper.ValidAmount.selector) {
                uint256 value;
                uint256 iterations;
                bool swapWETHForOETHB;

                // solhint-disable-next-line no-inline-assembly
                assembly {
                    value := mload(add(reason, 0x24))
                    iterations := mload(add(reason, 0x44))
                    swapWETHForOETHB := mload(add(reason, 0x64))
                }
                emit ValueFound(value, iterations, swapWETHForOETHB);
                return Data({ amount: value, iterations: iterations });
            }

            if (receivedSelector == QuoterHelper.OutOfIterations.selector) {
                emit ValueNotFound("Out of iterations");
                revert("Out of iterations");
            }

            emit ValueNotFound("Unexpected error");
            revert(abi.decode(reason, (string)));
        }
    }
}
