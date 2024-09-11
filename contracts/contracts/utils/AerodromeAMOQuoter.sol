// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.7;

import { ICLPool } from "../interfaces/aerodrome/ICLPool.sol";
import { IQuoterV2 } from "../interfaces/aerodrome/IQuoterV2.sol";
import { IAMOStrategy } from "../interfaces/aerodrome/IAMOStrategy.sol";

/// @title QuoterHelper
/// @author Origin Protocol
/// @notice Helper for Aerodrome AMO Quoter, as `_quoteAmountToSwapBeforeRebalance` use try/catch method and
///         this can only be used when calling external contracts.
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
    uint256 public constant BINARY_MAX_ITERATIONS = 100;
    uint256 public constant PERCENTAGE_BASE = 1e18; // 100%
    uint256 public constant ALLOWED_VARIANCE_PERCENTAGE = 1e16; // 1%

    ////////////////////////////////////////////////////////////////
    /// --- VARIABLES STORAGE
    ////////////////////////////////////////////////////////////////
    ICLPool public clPool;
    IQuoterV2 public quoterV2;
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
    constructor(IAMOStrategy _strategy, IQuoterV2 _quoterV2) {
        strategy = _strategy;
        quoterV2 = _quoterV2;
        clPool = strategy.clPool();
    }

    ////////////////////////////////////////////////////////////////
    /// --- FUNCTIONS
    ////////////////////////////////////////////////////////////////
    /// @notice This call can only end with a revert.
    function getAmountToSwapBeforeRebalance(
        uint256 overrideBottomWethShare,
        uint256 overrideTopWethShare
    ) public {
        if (
            overrideBottomWethShare != type(uint256).max ||
            overrideTopWethShare != type(uint256).max
        ) {
            // Current values
            uint256 shareStart = strategy.allowedWethShareStart();
            uint256 shareEnd = strategy.allowedWethShareEnd();

            // Override values
            if (overrideBottomWethShare != type(uint256).max) {
                shareStart = overrideBottomWethShare;
            }
            if (overrideTopWethShare != type(uint256).max) {
                shareEnd = overrideTopWethShare;
            }

            strategy.setAllowedPoolWethShareInterval(shareStart, shareEnd);
        }
        uint256 iterations;
        uint256 low = BINARY_MIN_AMOUNT;
        uint256 high = BINARY_MAX_AMOUNT;
        int24 lowerTick = strategy.lowerTick();
        int24 upperTick = strategy.upperTick();
        bool swapWETHForOETHB = getSwapDirectionForRebalance();

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

    /// @notice Get the status of the rebalance
    /// @param amount The amount of token to swap
    /// @param swapWETH True if we need to swap WETH for OETHb, false otherwise
    /// @return status The status of the rebalance
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

    /// @notice Get the swap direction to reach the target price before rebalance.
    /// @return bool True if we need to swap WETH for OETHb, false otherwise.
    function getSwapDirectionForRebalance() public view returns (bool) {
        uint160 currentPrice = strategy.getPoolX96Price();
        uint160 ticker0Price = strategy.sqrtRatioX96TickLower();
        uint160 ticker1Price = strategy.sqrtRatioX96TickHigher();
        uint160 targetPrice = (ticker0Price * 20 + ticker1Price * 80) / 100;

        return currentPrice > targetPrice;
    }

    /// @notice Get the amount of tokens to swap to reach the target price.
    /// @dev This act like a quoter, i.e. the transaction is not performed.
    /// @param sqrtPriceTargetX96 The target price to reach.
    /// @return amount The amount of tokens to swap.
    /// @return iterations The number of iterations to find the amount.
    /// @return swapWETHForOETHB True if we need to swap WETH for OETHb, false otherwise.
    /// @return sqrtPriceX96After The price after the swap.
    function getAmountToSwapToReachPrice(uint160 sqrtPriceTargetX96)
        public
        returns (
            uint256,
            uint256,
            bool,
            uint160
        )
    {
        uint256 iterations;
        uint256 low = BINARY_MIN_AMOUNT;
        uint256 high = BINARY_MAX_AMOUNT;
        bool swapWETHForOETHB = getSwapDirection(sqrtPriceTargetX96);

        while (low <= high && iterations < BINARY_MAX_ITERATIONS) {
            uint256 mid = (low + high) / 2;

            // Call QuoterV2 from SugarHelper
            (, uint160 sqrtPriceX96After, , ) = quoterV2.quoteExactInputSingle(
                IQuoterV2.QuoteExactInputSingleParams({
                    tokenIn: swapWETHForOETHB
                        ? clPool.token0()
                        : clPool.token1(),
                    tokenOut: swapWETHForOETHB
                        ? clPool.token1()
                        : clPool.token0(),
                    amountIn: mid,
                    tickSpacing: strategy.tickSpacing(),
                    sqrtPriceLimitX96: sqrtPriceTargetX96
                })
            );

            if (
                low == high ||
                isWithinAllowedVariance(sqrtPriceX96After, sqrtPriceTargetX96)
            ) {
                return (mid, iterations, swapWETHForOETHB, sqrtPriceX96After);
            } else if (
                swapWETHForOETHB
                    ? sqrtPriceX96After > sqrtPriceTargetX96
                    : sqrtPriceX96After < sqrtPriceTargetX96
            ) {
                low = mid + 1;
            } else {
                high = mid;
            }
            iterations++;
        }

        revert OutOfIterations(iterations);
    }

    /// @notice Check if the current price is within the allowed variance in comparison to the target price
    /// @return bool True if the current price is within the allowed variance, false otherwise
    function isWithinAllowedVariance(
        uint160 sqrtPriceCurrentX96,
        uint160 sqrtPriceTargetX96
    ) public view returns (bool) {
        uint160 range = strategy.sqrtRatioX96TickHigher() -
            strategy.sqrtRatioX96TickLower();
        if (sqrtPriceCurrentX96 > sqrtPriceTargetX96) {
            return
                (sqrtPriceCurrentX96 - sqrtPriceTargetX96) <=
                (ALLOWED_VARIANCE_PERCENTAGE * range) / PERCENTAGE_BASE;
        } else {
            return
                (sqrtPriceTargetX96 - sqrtPriceCurrentX96) <=
                (ALLOWED_VARIANCE_PERCENTAGE * range) / PERCENTAGE_BASE;
        }
    }

    /// @notice Get the swap direction to reach the target price.
    /// @param sqrtPriceTargetX96 The target price to reach.
    /// @return bool True if we need to swap WETH for OETHb, false otherwise.
    function getSwapDirection(uint160 sqrtPriceTargetX96)
        public
        view
        returns (bool)
    {
        uint160 currentPrice = strategy.getPoolX96Price();
        return currentPrice > sqrtPriceTargetX96;
    }
}

/// @title AerodromeAMOQuoter
/// @author Origin Protocol
/// @notice Quoter for Aerodrome AMO
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
    constructor(address _strategy, address _quoterV2) {
        quoterHelper = new QuoterHelper(
            IAMOStrategy(_strategy),
            IQuoterV2(_quoterV2)
        );
    }

    ////////////////////////////////////////////////////////////////
    /// --- ERRORS & EVENTS
    ////////////////////////////////////////////////////////////////
    event ValueFound(uint256 value, uint256 iterations, bool swapWETHForOETHB);
    event ValueFoundBis(
        uint256 value,
        uint256 iterations,
        bool swapWETHForOETHB,
        uint160 sqrtPriceAfterX96
    );
    event ValueNotFound(string message);

    ////////////////////////////////////////////////////////////////
    /// --- FUNCTIONS
    ////////////////////////////////////////////////////////////////
    /// @notice Use this to get the amount to swap before rebalance
    /// @dev This call will only revert, check the logs to get returned values.
    /// @dev Need to perform this call while impersonating the governor or strategist of AMO.
    /// @return data Data struct with the amount and the number of iterations
    function quoteAmountToSwapBeforeRebalance()
        public
        returns (Data memory data)
    {
        return
            _quoteAmountToSwapBeforeRebalance(
                type(uint256).max,
                type(uint256).max
            );
    }

    /// @notice Use this to get the amount to swap before rebalance and
    ///         update allowedWethShareStart and allowedWethShareEnd on AMO.
    /// @dev This call will only revert, check the logs to get returned values.
    /// @dev Need to perform this call while impersonating the governor of AMO.
    /// @param overrideBottomWethShare New value for the allowedWethShareStart on AMO.
    ///         Use type(uint256).max to keep same value.
    /// @param overrideTopWethShare New value for the allowedWethShareEnd on AMO.
    ///         Use type(uint256).max to keep same value.
    /// @return data Data struct with the amount and the number of iterations
    function quoteAmountToSwapBeforeRebalance(
        uint256 overrideBottomWethShare,
        uint256 overrideTopWethShare
    ) public returns (Data memory data) {
        return
            _quoteAmountToSwapBeforeRebalance(
                overrideBottomWethShare,
                overrideTopWethShare
            );
    }

    /// @notice Internal logic for quoteAmountToSwapBeforeRebalance.
    function _quoteAmountToSwapBeforeRebalance(
        uint256 overrideBottomWethShare,
        uint256 overrideTopWethShare
    ) public returns (Data memory data) {
        try
            quoterHelper.getAmountToSwapBeforeRebalance(
                overrideBottomWethShare,
                overrideTopWethShare
            )
        {
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

    /// @notice Use this to get the amount to swap to reach the target price after swap.
    /// @dev This call will only revert, check the logs to get returned values.
    /// @param sqrtPriceTargetX96 The target price to reach.
    function quoteAmountToSwapToReachPrice(uint160 sqrtPriceTargetX96) public {
        (
            uint256 amount,
            uint256 iterations,
            bool swapWETHForOETHB,
            uint160 sqrtPriceAfterX96
        ) = quoterHelper.getAmountToSwapToReachPrice(sqrtPriceTargetX96);

        emit ValueFoundBis(
            amount,
            iterations,
            swapWETHForOETHB,
            sqrtPriceAfterX96
        );
    }
}
