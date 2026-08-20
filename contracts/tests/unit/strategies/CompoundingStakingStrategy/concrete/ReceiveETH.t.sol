// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingStrategy/shared/Shared.t.sol";

contract Unit_Concrete_CompoundingStakingStrategy_ReceiveETH_Test is Unit_CompoundingStakingStrategy_Shared_Test {
    function test_receiveETH_fromAnyone() public {
        // CompoundingStaking accepts ETH from anyone
        vm.deal(strategist, 10 ether);
        vm.prank(strategist);
        (bool success,) = address(compoundingStakingStrategy).call{value: 2 ether}("");
        assertTrue(success);
        assertEq(address(compoundingStakingStrategy).balance, 2 ether);
    }
}
