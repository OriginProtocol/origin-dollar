// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDirectStakingHandler {
    function stake(
        uint256 wethAmount,
        uint256 minAmountOut,
        bool callback
    ) external payable returns (bytes32);
}
