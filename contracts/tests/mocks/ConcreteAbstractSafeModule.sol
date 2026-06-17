// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {AbstractSafeModule} from "contracts/automation/AbstractSafeModule.sol";

contract ConcreteAbstractSafeModule is AbstractSafeModule {
    constructor(address _safeContract) AbstractSafeModule(_safeContract) {}
}
