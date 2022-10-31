// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "openzeppelin-4.6.0/governance/TimelockController.sol";

contract Timelock is TimelockController {
    constructor(address[] memory proposers, address[] memory executors)
        TimelockController(86400 * 2, proposers, executors)
    {}
}
