// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Unit_Concrete_SonicStakingStrategy_RestakeRewards_Test is Unit_SonicStakingStrategy_Shared_Test {
    function test_restakeRewards_callsSFC() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        uint256 rewardAmount = 1 ether;
        mockSfc.setRewards(address(sonicStakingStrategy), 18, rewardAmount);

        uint256 stakedBefore = mockSfc.getStake(address(sonicStakingStrategy), 18);

        uint256[] memory validatorIds = new uint256[](1);
        validatorIds[0] = 18;

        vm.prank(alice); // anyone can call
        sonicStakingStrategy.restakeRewards(validatorIds);

        uint256 stakedAfter = mockSfc.getStake(address(sonicStakingStrategy), 18);
        assertEq(stakedAfter, stakedBefore + rewardAmount);

        // Rewards should be cleared
        uint256 pendingRewards = mockSfc.pendingRewards(address(sonicStakingStrategy), 18);
        assertEq(pendingRewards, 0);
    }

    function test_restakeRewards_skipsZeroRewards() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        // No rewards set - should not revert
        uint256[] memory validatorIds = new uint256[](1);
        validatorIds[0] = 18;

        uint256 stakedBefore = mockSfc.getStake(address(sonicStakingStrategy), 18);

        sonicStakingStrategy.restakeRewards(validatorIds);

        uint256 stakedAfter = mockSfc.getStake(address(sonicStakingStrategy), 18);
        assertEq(stakedAfter, stakedBefore);
    }

    function test_restakeRewards_RevertWhen_unsupportedValidator() public {
        uint256[] memory validatorIds = new uint256[](1);
        validatorIds[0] = 99; // not supported

        vm.expectRevert("Validator not supported");
        sonicStakingStrategy.restakeRewards(validatorIds);
    }

    function test_restakeRewards_anyoneCanCall() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        mockSfc.setRewards(address(sonicStakingStrategy), 18, 1 ether);

        uint256[] memory validatorIds = new uint256[](1);
        validatorIds[0] = 18;

        // Should work from any address
        vm.prank(alice);
        sonicStakingStrategy.restakeRewards(validatorIds);

        assertEq(mockSfc.pendingRewards(address(sonicStakingStrategy), 18), 0);
    }
}
