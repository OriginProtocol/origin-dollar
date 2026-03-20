// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_BaseBridgeHelperModule_Shared_Test
} from "tests/unit/automation/BaseBridgeHelperModule/shared/Shared.t.sol";

contract Unit_Concrete_BaseBridgeHelperModule_AccessControl_Test is Unit_BaseBridgeHelperModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ACCESS CONTROL
    //////////////////////////////////////////////////////

    function test_revertWhen_bridgeWOETHToEthereum_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        baseBridgeHelperModule.bridgeWOETHToEthereum(1 ether);
    }

    function test_revertWhen_bridgeWETHToEthereum_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        baseBridgeHelperModule.bridgeWETHToEthereum(1 ether);
    }

    function test_revertWhen_depositWOETH_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        baseBridgeHelperModule.depositWOETH(1 ether, false);
    }

    function test_revertWhen_claimAndBridgeWETH_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        baseBridgeHelperModule.claimAndBridgeWETH(1);
    }

    function test_revertWhen_claimWithdrawal_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        baseBridgeHelperModule.claimWithdrawal(1);
    }

    function test_revertWhen_depositWETHAndRedeemWOETH_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        baseBridgeHelperModule.depositWETHAndRedeemWOETH(1 ether);
    }

    function test_revertWhen_depositWETHAndBridgeWOETH_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        baseBridgeHelperModule.depositWETHAndBridgeWOETH(1 ether);
    }
}
