// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_EthereumBridgeHelperModule_Shared_Test
} from "tests/fork/mainnet/automation/EthereumBridgeHelperModule/shared/Shared.t.sol";

contract Fork_Concrete_EthereumBridgeHelperModule_BridgeWETHToBase_Test is Fork_EthereumBridgeHelperModule_Shared_Test {
    function test_bridgeWETHToBase() public {
        uint256 amount = 1 ether;
        _fundSafeWithWETH(1.1 ether);

        uint256 balanceBefore = weth.balanceOf(safeSigner);

        vm.prank(safeSigner);
        ethereumBridgeHelperModule.bridgeWETHToBase(amount);

        uint256 balanceAfter = weth.balanceOf(safeSigner);
        assertEq(balanceAfter, balanceBefore - amount, "WETH balance should decrease by bridged amount");
    }
}
