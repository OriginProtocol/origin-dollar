// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_EthereumBridgeHelperModule_Shared_Test
} from "tests/fork/mainnet/automation/EthereumBridgeHelperModule/shared/Shared.t.sol";

contract Fork_Concrete_EthereumBridgeHelperModule_BridgeWOETHToBase_Test is
    Fork_EthereumBridgeHelperModule_Shared_Test
{
    function test_bridgeWOETHToBase() public {
        uint256 amount = 1 ether;
        _mintWOETHForSafe(amount);

        uint256 balanceBefore = woeth.balanceOf(safeSigner);

        vm.prank(safeSigner);
        ethereumBridgeHelperModule.bridgeWOETHToBase(amount);

        uint256 balanceAfter = woeth.balanceOf(safeSigner);
        assertEq(balanceAfter, balanceBefore - amount, "wOETH balance should decrease by bridged amount");
    }
}
