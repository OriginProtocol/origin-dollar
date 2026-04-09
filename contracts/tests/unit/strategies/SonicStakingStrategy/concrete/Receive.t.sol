// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SonicStakingStrategy_Shared_Test} from "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Unit_Concrete_SonicStakingStrategy_Receive_Test is Unit_SonicStakingStrategy_Shared_Test {
    function test_receive_acceptsFromSFC() public {
        vm.deal(address(mockSfc), 1 ether);
        vm.prank(address(mockSfc));
        (bool success,) = address(sonicStakingStrategy).call{value: 1 ether}("");
        assertTrue(success);
        assertEq(address(sonicStakingStrategy).balance, 1 ether);
    }

    function test_receive_acceptsFromWrappedSonic() public {
        vm.deal(address(mockWrappedSonic), 1 ether);
        vm.prank(address(mockWrappedSonic));
        (bool success,) = address(sonicStakingStrategy).call{value: 1 ether}("");
        assertTrue(success);
        assertEq(address(sonicStakingStrategy).balance, 1 ether);
    }

    function test_receive_RevertWhen_fromOther() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool success,) = address(sonicStakingStrategy).call{value: 1 ether}("");
        assertFalse(success);
    }
}
