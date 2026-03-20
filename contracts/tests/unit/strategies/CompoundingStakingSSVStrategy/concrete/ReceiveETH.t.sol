// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CompoundingStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_ReceiveETH_Test
    is Unit_CompoundingStakingSSVStrategy_Shared_Test
{
    function test_receiveETH_fromAnyone() public {
        // Unlike NativeStakingSSVStrategy, CompoundingStaking accepts ETH from anyone
        vm.deal(strategist, 10 ether);
        vm.prank(strategist);
        (bool success,) = address(compoundingStakingSSVStrategy).call{value: 2 ether}("");
        assertTrue(success);
        assertEq(address(compoundingStakingSSVStrategy).balance, 2 ether);
    }
}
