// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_BaseBridgeHelperModule_Shared_Test} from
    "tests/fork/automation/BaseBridgeHelperModule/shared/Shared.t.sol";

contract Fork_Concrete_BaseBridgeHelperModule_BridgeWOETHToEthereum_Test
    is
    Fork_BaseBridgeHelperModule_Shared_Test
{
    function test_bridgeWOETHToEthereum() public {
        uint256 amount = 1 ether;
        _mintBridgedWOETH(safeSigner, amount);

        uint256 balanceBefore = bridgedWoeth.balanceOf(safeSigner);

        vm.prank(safeSigner);
        baseBridgeHelperModule.bridgeWOETHToEthereum(amount);

        uint256 balanceAfter = bridgedWoeth.balanceOf(safeSigner);
        assertEq(balanceAfter, balanceBefore - amount, "wOETH balance should decrease by bridged amount");
    }
}
