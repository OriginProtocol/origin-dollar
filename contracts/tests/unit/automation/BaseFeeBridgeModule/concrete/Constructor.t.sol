// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BaseFeeBridgeModule_Shared_Test} from "tests/unit/automation/BaseFeeBridgeModule/shared/Shared.t.sol";

contract Unit_Concrete_BaseFeeBridgeModule_Constructor_Test is Unit_BaseFeeBridgeModule_Shared_Test {
    function test_constructor_immutablesSet() public view {
        assertEq(module.safeContract(), address(mockSafe));
        assertEq(module.vault(), address(vault));
        assertEq(module.ccipRouter(), address(router));
        assertEq(module.destinationChainSelector(), DEST_SELECTOR);
        assertEq(module.feeSplitter(), feeSplitter);
    }

    function test_constructor_wethIsVaultAsset() public view {
        assertEq(module.weth(), address(mockWeth));
    }

    function test_constructor_noPendingRequest() public view {
        assertFalse(module.hasPendingRequest());
        assertEq(module.lastRequestAt(), 0);
    }

    function test_constructor_operatorRoleGranted() public view {
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), operator));
    }

    function test_constructor_safeHasAdminRole() public view {
        assertTrue(module.hasRole(module.DEFAULT_ADMIN_ROLE(), address(mockSafe)));
    }

    function test_constructor_revertsOnZeroOperator() public {
        vm.expectRevert("Invalid operator");
        _deployModule(address(0), feeSplitter);
    }

    function test_constructor_revertsOnZeroFeeSplitter() public {
        vm.expectRevert("Invalid fee splitter");
        _deployModule(operator, address(0));
    }
}
