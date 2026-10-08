// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_PauseSafeModule_Shared_Test} from "tests/unit/automation/PauseSafeModule/shared/Shared.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";

contract Unit_Concrete_PauseSafeModule_Constructor_Test is Unit_PauseSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    //////////////////////////////////////////////////////

    function test_constructor_safeContractSet() public view {
        assertEq(pauseSafeModule.safeContract(), address(mockSafe));
    }

    function test_constructor_initialTargetAllowed() public view {
        assertTrue(pauseSafeModule.isPausableTarget(address(oethVault)));
    }

    function test_constructor_unlistedVaultNotAllowed() public view {
        assertFalse(pauseSafeModule.isPausableTarget(address(unlistedVault)));
    }

    function test_constructor_operatorRoleGranted() public view {
        assertTrue(pauseSafeModule.hasRole(pauseSafeModule.OPERATOR_ROLE(), operator));
    }

    function test_constructor_safeHasAdminRole() public view {
        assertTrue(pauseSafeModule.hasRole(pauseSafeModule.DEFAULT_ADMIN_ROLE(), address(mockSafe)));
    }

    function test_constructor_safeHasOperatorRole() public view {
        assertTrue(pauseSafeModule.hasRole(pauseSafeModule.OPERATOR_ROLE(), address(mockSafe)));
    }

    function test_constructor_revertsOnZeroOperator() public {
        address[] memory operators = new address[](1);
        operators[0] = address(0);
        address[] memory targets = new address[](0);

        vm.expectRevert("Invalid operator");
        vm.deployCode(Automation.PAUSE_SAFE_MODULE, abi.encode(address(mockSafe), operators, targets));
    }

    function test_constructor_revertsOnZeroTarget() public {
        address[] memory operators = new address[](1);
        operators[0] = operator;
        address[] memory targets = new address[](1);
        targets[0] = address(0);

        vm.expectRevert("Target has no code");
        vm.deployCode(Automation.PAUSE_SAFE_MODULE, abi.encode(address(mockSafe), operators, targets));
    }

    function test_constructor_revertsOnEOATarget() public {
        address[] memory operators = new address[](1);
        operators[0] = operator;
        address[] memory targets = new address[](1);
        targets[0] = alice;

        vm.expectRevert("Target has no code");
        vm.deployCode(Automation.PAUSE_SAFE_MODULE, abi.encode(address(mockSafe), operators, targets));
    }
}
