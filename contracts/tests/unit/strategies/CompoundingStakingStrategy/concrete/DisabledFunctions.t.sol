// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingStrategy/shared/Shared.t.sol";

// --- Project imports
import {ICompoundingStakingStrategy} from "contracts/interfaces/strategies/ICompoundingStakingStrategy.sol";

contract Unit_Concrete_CompoundingStakingStrategy_DisabledFunctions_Test is
    Unit_CompoundingStakingStrategy_Shared_Test
{
    function test_collectRewardTokens_reverts() public {
        // Set harvester to governor so we can call it
        vm.prank(governor);
        compoundingStakingStrategy.setHarvesterAddress(governor);

        vm.prank(governor);
        vm.expectRevert(ICompoundingStakingStrategy.UnsupportedFunction.selector);
        compoundingStakingStrategy.collectRewardTokens();
    }

    function test_setPTokenAddress_reverts() public {
        vm.expectRevert(ICompoundingStakingStrategy.UnsupportedFunction.selector);
        compoundingStakingStrategy.setPTokenAddress(address(mockWeth), address(mockWeth));
    }

    function test_removePToken_reverts() public {
        vm.expectRevert(ICompoundingStakingStrategy.UnsupportedFunction.selector);
        compoundingStakingStrategy.removePToken(0);
    }
}
