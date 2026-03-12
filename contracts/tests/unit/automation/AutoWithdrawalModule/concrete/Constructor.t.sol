// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_AutoWithdrawalModule_Shared_Test} from
    "tests/unit/automation/AutoWithdrawalModule/shared/Shared.t.sol";

import {AutoWithdrawalModule} from "contracts/automation/AutoWithdrawalModule.sol";

contract Unit_Concrete_AutoWithdrawalModule_Constructor_Test is Unit_AutoWithdrawalModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_constructor_vaultIsSet() public view {
        assertEq(address(autoWithdrawalModule.vault()), address(mockVault));
    }

    function test_constructor_assetIsSet() public view {
        assertEq(autoWithdrawalModule.asset(), address(assetToken));
    }

    function test_constructor_strategyIsSet() public view {
        assertEq(autoWithdrawalModule.strategy(), address(mockStrategy));
    }

    function test_constructor_safeContractIsSet() public view {
        assertEq(address(autoWithdrawalModule.safeContract()), address(mockSafe));
    }

    function test_constructor_operatorRoleGranted() public view {
        assertTrue(autoWithdrawalModule.hasRole(autoWithdrawalModule.OPERATOR_ROLE(), operator));
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_constructor_RevertWhen_zeroVault() public {
        vm.expectRevert("Invalid vault");
        new AutoWithdrawalModule(
            address(mockSafe),
            operator,
            address(0),
            address(mockStrategy)
        );
    }

    function test_constructor_RevertWhen_zeroStrategy() public {
        vm.expectRevert("Invalid strategy");
        new AutoWithdrawalModule(
            address(mockSafe),
            operator,
            address(mockVault),
            address(0)
        );
    }
}
