// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_DisabledFunctions_Test is
    Unit_CompoundingStakingSSVStrategy_Shared_Test
{
    function test_collectRewardTokens_reverts() public {
        // Set harvester to governor so we can call it
        vm.prank(governor);
        compoundingStakingSSVStrategy.setHarvesterAddress(governor);

        vm.prank(governor);
        vm.expectRevert("Unsupported function");
        compoundingStakingSSVStrategy.collectRewardTokens();
    }

    function test_setPTokenAddress_reverts() public {
        vm.expectRevert("Unsupported function");
        compoundingStakingSSVStrategy.setPTokenAddress(address(mockWeth), address(mockWeth));
    }

    function test_removePToken_reverts() public {
        vm.expectRevert("Unsupported function");
        compoundingStakingSSVStrategy.removePToken(0);
    }
}
