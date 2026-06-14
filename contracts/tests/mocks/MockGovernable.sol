// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Governable} from "contracts/governance/Governable.sol";
import {Strategizable} from "contracts/governance/Strategizable.sol";
import {InitializableGovernable} from "contracts/governance/InitializableGovernable.sol";

/**
 * @title MockGovernable
 * @dev Concrete harness exposing Governable internals for testing.
 */
contract MockGovernable is Governable {
    function setGovernor(address _governor) external {
        _setGovernor(_governor);
    }

    function changeGovernor(address _governor) external {
        _changeGovernor(_governor);
    }

    function protectedFunction() external nonReentrant returns (uint256) {
        return 1;
    }

    function protectedWithCallback(address target) external nonReentrant {
        target.call("");
    }
}

/**
 * @title ReentrancyAttacker
 * @dev Attempts to re-enter MockGovernable when called.
 */
contract ReentrancyAttacker {
    MockGovernable public target;

    constructor(MockGovernable _target) {
        target = _target;
    }

    fallback() external {
        target.protectedFunction();
    }
}

/**
 * @title MockStrategizable
 * @dev Concrete harness exposing onlyGovernorOrStrategist for testing.
 */
contract MockStrategizable is Strategizable {
    function guardedFunction() external onlyGovernorOrStrategist returns (uint256) {
        return 1;
    }
}

/**
 * @title MockInitializableGovernable
 * @dev Concrete harness exposing _initialize for testing.
 */
contract MockInitializableGovernable is InitializableGovernable {
    function initialize(address _governor) external initializer {
        _initialize(_governor);
    }
}
