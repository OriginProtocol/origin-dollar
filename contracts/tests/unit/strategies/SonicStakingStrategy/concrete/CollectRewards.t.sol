// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Unit_Concrete_SonicStakingStrategy_CollectRewards_Test is Unit_SonicStakingStrategy_Shared_Test {
    function test_collectRewards_wrapsAndTransfersToVault() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        uint256 rewardAmount = 2 ether;
        mockSfc.setRewards(address(sonicStakingStrategy), 18, rewardAmount);
        // Fund SFC with native S for reward payout
        vm.deal(address(mockSfc), rewardAmount);

        uint256 vaultBalBefore = mockWrappedSonic.balanceOf(address(oSonicVault));

        uint256[] memory validatorIds = new uint256[](1);
        validatorIds[0] = 18;

        vm.prank(strategist);
        sonicStakingStrategy.collectRewards(validatorIds);

        uint256 vaultBalAfter = mockWrappedSonic.balanceOf(address(oSonicVault));
        assertEq(vaultBalAfter - vaultBalBefore, rewardAmount);
    }

    function test_collectRewards_skipsZeroRewards() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        // No rewards set - should not revert but transfer 0
        uint256[] memory validatorIds = new uint256[](1);
        validatorIds[0] = 18;

        // collectRewards calls _withdraw which requires amount > 0
        // But if no rewards, the rewardsAmount is 0, and wrapping 0 is fine,
        // but _withdraw will revert with "Must withdraw something"
        // Actually let's check: if all validators have 0 rewards, the loop skips all,
        // rewardsAmount = 0, then it tries to wrap 0 and transfer 0
        // The _withdraw call with 0 will revert
        // So let's test that it reverts when total rewards is 0
        vm.prank(strategist);
        vm.expectRevert("Must withdraw something");
        sonicStakingStrategy.collectRewards(validatorIds);
    }

    function test_collectRewards_RevertWhen_calledByNonRegistratorOrStrategist() public {
        uint256[] memory validatorIds = new uint256[](1);
        validatorIds[0] = 18;

        vm.prank(alice);
        vm.expectRevert("Caller is not the Registrator or Strategist");
        sonicStakingStrategy.collectRewards(validatorIds);
    }
}
