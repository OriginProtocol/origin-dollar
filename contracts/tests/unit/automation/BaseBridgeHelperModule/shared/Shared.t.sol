// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {BaseBridgeHelperModule} from "contracts/automation/BaseBridgeHelperModule.sol";

abstract contract Unit_BaseBridgeHelperModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////
    MockSafeContract internal mockSafe;
    BaseBridgeHelperModule internal baseBridgeHelperModule;

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

        // Deploy BaseBridgeHelperModule
        baseBridgeHelperModule = new BaseBridgeHelperModule(address(mockSafe));

        // Grant OPERATOR_ROLE to operator via safe
        mockSafe.execTransactionFromModule(
            address(baseBridgeHelperModule),
            0,
            abi.encodeWithSelector(
                baseBridgeHelperModule.grantRole.selector, baseBridgeHelperModule.OPERATOR_ROLE(), operator
            ),
            0
        );
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(address(baseBridgeHelperModule), "BaseBridgeHelperModule");
    }
}
