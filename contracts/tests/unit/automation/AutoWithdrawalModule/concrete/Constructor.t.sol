// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_AutoWithdrawalModule_Shared_Test} from "tests/unit/automation/AutoWithdrawalModule/shared/Shared.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/Artifacts.sol";

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
        vm.deployCode(
            Automation.AUTO_WITHDRAWAL_MODULE,
            abi.encode(address(mockSafe), operator, address(0), address(mockStrategy))
        );
    }

    function test_constructor_RevertWhen_zeroStrategy() public {
        vm.expectRevert("Invalid strategy");
        vm.deployCode(
            Automation.AUTO_WITHDRAWAL_MODULE, abi.encode(address(mockSafe), operator, address(mockVault), address(0))
        );
    }
}
