// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_ClaimBribesSafeModule_Shared_Test} from
    "tests/unit/automation/ClaimBribesSafeModule/shared/Shared.t.sol";

import {ClaimBribesSafeModule} from "contracts/automation/ClaimBribesSafeModule.sol";

contract Unit_Concrete_ClaimBribesSafeModule_ClaimBribes_Test is Unit_ClaimBribesSafeModule_Shared_Test {
    function setUp() public override {
        super.setUp();

        // Set up reward tokens on the reward contract (used as a voting bribe pool)
        address[] memory rewardTokens = new address[](2);
        rewardTokens[0] = makeAddr("RewardTokenA");
        rewardTokens[1] = makeAddr("RewardTokenB");
        mockRewardContract.setRewards(rewardTokens);
    }

    //////////////////////////////////////////////////////
    /// --- CLAIM BRIBES
    //////////////////////////////////////////////////////

    function test_claimBribes_claimsForAllNFTs() public {
        _addNFT(1);
        _addNFT(2);
        _addBribePoolAsVoting(address(mockRewardContract));

        vm.prank(operator);
        claimBribesModule.claimBribes(0, 2, false);
    }

    function test_claimBribes_swapsIndicesWhenStartGreaterThanEnd() public {
        _addNFT(1);
        _addNFT(2);
        _addBribePoolAsVoting(address(mockRewardContract));

        // Should work the same as (0, 2, false)
        vm.prank(operator);
        claimBribesModule.claimBribes(2, 0, false);
    }

    function test_claimBribes_capsEndAtNftCount() public {
        _addNFT(1);
        _addNFT(2);
        _addBribePoolAsVoting(address(mockRewardContract));

        // Should not revert even though end=100 > nftCount=2
        vm.prank(operator);
        claimBribesModule.claimBribes(0, 100, false);
    }

    function test_claimBribes_silentModeDoesNotRevertOnFailure() public {
        _addNFT(1);
        _addBribePoolAsVoting(address(mockRewardContract));

        // Make safe return false without calling voter
        mockSafe.setShouldFail(true);

        vm.prank(operator);
        claimBribesModule.claimBribes(0, 1, true);
    }

    function test_claimBribes_RevertWhen_notSilentAndFails() public {
        _addNFT(1);
        _addBribePoolAsVoting(address(mockRewardContract));

        // Make safe return false
        mockSafe.setShouldFail(true);

        vm.prank(operator);
        vm.expectRevert("ClaimBribes failed");
        claimBribesModule.claimBribes(0, 1, false);
    }

    function test_claimBribes_RevertWhen_voterFails() public {
        _addNFT(1);
        _addBribePoolAsVoting(address(mockRewardContract));

        // Make voter revert (safe call returns false since low-level call fails)
        mockVoter.setShouldFail(true);

        vm.prank(operator);
        vm.expectRevert("ClaimBribes failed");
        claimBribesModule.claimBribes(0, 1, false);
    }

    function test_claimBribes_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not an operator");
        claimBribesModule.claimBribes(0, 1, false);
    }
}
