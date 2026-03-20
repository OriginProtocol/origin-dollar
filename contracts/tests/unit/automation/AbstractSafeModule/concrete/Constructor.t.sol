// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_AbstractSafeModule_Shared_Test} from
    "tests/unit/automation/AbstractSafeModule/shared/Shared.t.sol";

contract Unit_Concrete_AbstractSafeModule_Constructor_Test is Unit_AbstractSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    //////////////////////////////////////////////////////

    function test_constructor_safeContractIsSet() public view {
        assertEq(address(module.safeContract()), address(mockSafe));
    }

    function test_constructor_defaultAdminRoleGrantedToSafe() public view {
        assertTrue(module.hasRole(module.DEFAULT_ADMIN_ROLE(), address(mockSafe)));
    }

    function test_constructor_operatorRoleGrantedToSafe() public view {
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), address(mockSafe)));
    }
}
