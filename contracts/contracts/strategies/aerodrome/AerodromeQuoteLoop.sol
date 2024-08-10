// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Aerodrome AMO Quote looper
 * @author Origin Protocol Inc
 */
import { IAMOCallback } from "../../interfaces/aerodrome/IAMOCallback.sol";
import { IAMOQuoteLoop } from "../../interfaces/aerodrome/IAMOQuoteLoop.sol";

contract AerodromeQuoteLoop is IAMOQuoteLoop {
    /**
     * 
     */
    function quoteLoop(uint256 _amount, bool _swapWETH) external override {
        IAMOCallback(msg.sender).quoteCallback(_amount, _swapWETH);
    }
}
