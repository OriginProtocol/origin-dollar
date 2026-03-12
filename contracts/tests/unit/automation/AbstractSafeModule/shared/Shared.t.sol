// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {AbstractSafeModule} from "contracts/automation/AbstractSafeModule.sol";

/// @notice Concrete implementation of AbstractSafeModule used as a test harness.
contract ConcreteAbstractSafeModule is AbstractSafeModule {
    constructor(address _safeContract) AbstractSafeModule(_safeContract) {}
}

abstract contract Unit_AbstractSafeModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    ConcreteAbstractSafeModule internal module;
    MockERC20 internal mockToken;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        label();
    }

    function _deployContracts() internal {
        // Deploy mock safe
        mockSafe = new MockSafeContract();

        // Deploy concrete module with mock safe as the safe contract
        module = new ConcreteAbstractSafeModule(address(mockSafe));

        // Deploy a mock ERC20 token
        mockToken = new MockERC20("Mock Token", "MTK", 18);
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(address(module), "ConcreteAbstractSafeModule");
        vm.label(address(mockToken), "MockToken");
    }
}
