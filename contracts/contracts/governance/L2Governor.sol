// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { TimelockController } from "@openzeppelin/contracts/governance/TimelockController.sol";

contract L2Governor is TimelockController {
    constructor(address[] memory proposers, address[] memory executors)
        TimelockController(86400, proposers, executors)
    {}
}
