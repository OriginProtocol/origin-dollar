// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IOETHZapper {
    function deposit() external payable returns (uint256);
}
