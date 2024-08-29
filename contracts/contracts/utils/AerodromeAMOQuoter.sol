// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

import { IAMOStrategy } from "../interfaces/aerodrome/IAMOStrategy.sol";

contract QuoterHelper {
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

    struct QuoterParams {
        address strategy;
        bool swapWETHForOETHB;
        uint256 minAmount;
        uint256 maxAmount;
        uint256 maxIterations;
    }

    error UnexpectedError(string message);
    error OutOfIterations(uint256 iterations);
    error ValidAmount(uint256 amount, uint256 iterations);

    /// @notice This call can only end with a revert.
    function getAmountToSwapBeforeRebalance(QuoterParams memory params) public {
        IAMOStrategy strategy = IAMOStrategy(params.strategy);
        uint256 iterations;
        uint256 low = params.minAmount;
        uint256 high = params.maxAmount;
        int24 lowerTick = strategy.lowerTick();
        int24 upperTick = strategy.upperTick();

        while (low <= high && iterations < params.maxIterations) {
            uint256 mid = (low + high) / 2;

            RebalanceStatus memory status = getRebalanceStatus(
                params.strategy,
                mid,
                params.swapWETHForOETHB
            );

            // Best case, we found the `amount` that will reach the target pool share!
            // We can revert with the amount and the number of iterations
            if (status.reason == RevertReasons.Found) {
                revert ValidAmount(mid, iterations);
            }

            // If the rebalance failed then we should try to change the amount.
            // We will handle all possible revert reasons here.

            // Case 1: Rebalance out of bounds
            // If the pool is out of bounds, we need to adjust the amount to reach the target pool share
            if (status.reason == RevertReasons.RebalanceOutOfBounds) {
                // If the current pool share is less than the target pool share, we need to increase the amount
                if (
                    params.swapWETHForOETHB
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
                    params.swapWETHForOETHB
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

    function getRebalanceStatus(
        address strategy,
        uint256 amount,
        bool swapWETH
    ) public returns (RebalanceStatus memory status) {
        try IAMOStrategy(strategy).rebalance(amount, swapWETH, 0) {
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
}

contract AerodromeAMOQuoter {
    QuoterHelper public quoterHelper;

    constructor() {
        quoterHelper = new QuoterHelper();
    }

    struct Data {
        uint256 amount;
        uint256 iterations;
    }

    event ValueFound(uint256 value, uint256 iterations);
    event ValueNotFound(string message);

    function quoteAmountToSwapBeforeRebalance(
        address strategy,
        bool swapWETHForOETHB,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 maxIterations
    ) public returns (Data memory data) {
        QuoterHelper.QuoterParams memory params = QuoterHelper.QuoterParams({
            strategy: strategy,
            swapWETHForOETHB: swapWETHForOETHB,
            minAmount: minAmount,
            maxAmount: maxAmount,
            maxIterations: maxIterations
        });
        try quoterHelper.getAmountToSwapBeforeRebalance(params) {
            revert("Previous call should only revert, it cannot succeed");
        } catch (bytes memory reason) {
            bytes4 receivedSelector = bytes4(reason);

            if (receivedSelector == QuoterHelper.ValidAmount.selector) {
                uint256 value;
                uint256 iterations;

                // solhint-disable-next-line no-inline-assembly
                assembly {
                    value := mload(add(reason, 0x24))
                    iterations := mload(add(reason, 0x44))
                }
                emit ValueFound(value, iterations);
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
