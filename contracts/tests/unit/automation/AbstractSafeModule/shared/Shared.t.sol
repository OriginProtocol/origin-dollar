// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- External libraries
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

// --- Project imports
import {ConcreteAbstractSafeModule} from "tests/mocks/ConcreteAbstractSafeModule.sol";
import {IAbstractSafeModule} from "contracts/interfaces/automation/IAbstractSafeModule.sol";
import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";

abstract contract Unit_AbstractSafeModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    MockSafeContract internal mockSafe;
    IAbstractSafeModule internal module;
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

        module = IAbstractSafeModule(address(new ConcreteAbstractSafeModule(address(mockSafe))));

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
