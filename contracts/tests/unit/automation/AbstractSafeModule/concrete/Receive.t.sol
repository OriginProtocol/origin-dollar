// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_AbstractSafeModule_Shared_Test} from
    "tests/unit/automation/AbstractSafeModule/shared/Shared.t.sol";

contract Unit_Concrete_AbstractSafeModule_Receive_Test is Unit_AbstractSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- RECEIVE
    //////////////////////////////////////////////////////

    function test_receive_moduleCanReceiveEth() public {
        vm.deal(alice, 5 ether);

        vm.prank(alice);
        (bool success,) = address(module).call{value: 5 ether}("");

        assertTrue(success);
        assertEq(address(module).balance, 5 ether);
    }
}
