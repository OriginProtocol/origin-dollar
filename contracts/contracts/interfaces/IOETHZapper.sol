// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IOETHZapper {
    function deposit() external payable returns (uint256);
}
