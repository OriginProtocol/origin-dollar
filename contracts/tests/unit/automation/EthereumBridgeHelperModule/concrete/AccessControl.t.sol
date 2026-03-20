// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_EthereumBridgeHelperModule_Shared_Test
} from "tests/unit/automation/EthereumBridgeHelperModule/shared/Shared.t.sol";

contract Unit_Concrete_EthereumBridgeHelperModule_AccessControl_Test is Unit_EthereumBridgeHelperModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ACCESS CONTROL
    //////////////////////////////////////////////////////

    function test_revertWhen_bridgeWOETHToBase_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        ethereumBridgeHelperModule.bridgeWOETHToBase(1 ether);
    }

    function test_revertWhen_bridgeWETHToBase_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        ethereumBridgeHelperModule.bridgeWETHToBase(1 ether);
    }

    function test_revertWhen_mintAndWrap_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        ethereumBridgeHelperModule.mintAndWrap(1 ether, false);
    }

    function test_revertWhen_wrapETH_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        ethereumBridgeHelperModule.wrapETH(1 ether);
    }

    function test_revertWhen_mintWrapAndBridgeToBase_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        ethereumBridgeHelperModule.mintWrapAndBridgeToBase(1 ether, false);
    }

    function test_revertWhen_unwrapAndRequestWithdrawal_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        ethereumBridgeHelperModule.unwrapAndRequestWithdrawal(1 ether);
    }

    function test_revertWhen_claimAndBridgeToBase_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        ethereumBridgeHelperModule.claimAndBridgeToBase(1);
    }

    function test_revertWhen_claimWithdrawal_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        ethereumBridgeHelperModule.claimWithdrawal(1);
    }
}
