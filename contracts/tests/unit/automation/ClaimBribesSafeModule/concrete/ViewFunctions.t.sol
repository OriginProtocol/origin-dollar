// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_ClaimBribesSafeModule_Shared_Test} from "tests/unit/automation/ClaimBribesSafeModule/shared/Shared.t.sol";

contract Unit_Concrete_ClaimBribesSafeModule_ViewFunctions_Test is Unit_ClaimBribesSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_nftIdExists_returnsTrueForExisting() public {
        _addNFT(1);
        assertTrue(claimBribesModule.nftIdExists(1));
    }

    function test_nftIdExists_returnsFalseForNonExisting() public view {
        assertFalse(claimBribesModule.nftIdExists(999));
    }

    function test_getNFTIdsLength_returnsCorrectLength() public {
        assertEq(claimBribesModule.getNFTIdsLength(), 0);

        _addNFT(1);
        assertEq(claimBribesModule.getNFTIdsLength(), 1);

        _addNFT(2);
        assertEq(claimBribesModule.getNFTIdsLength(), 2);
    }

    function test_getAllNFTIds_returnsAllIds() public {
        _addNFT(10);
        _addNFT(20);
        _addNFT(30);

        uint256[] memory ids = claimBribesModule.getAllNFTIds();
        assertEq(ids.length, 3);
        assertEq(ids[0], 10);
        assertEq(ids[1], 20);
        assertEq(ids[2], 30);
    }

    function test_getAllNFTIds_returnsEmptyWhenNone() public view {
        uint256[] memory ids = claimBribesModule.getAllNFTIds();
        assertEq(ids.length, 0);
    }

    function test_getBribePoolsLength_returnsCorrectLength() public {
        assertEq(claimBribesModule.getBribePoolsLength(), 0);

        address[] memory rewards = new address[](1);
        rewards[0] = makeAddr("RewardToken");
        mockRewardContract.setRewards(rewards);
        _addBribePoolAsVoting(address(mockRewardContract));

        assertEq(claimBribesModule.getBribePoolsLength(), 1);
    }

    function test_bribePoolExists_returnsTrueForExisting() public {
        address[] memory rewards = new address[](1);
        rewards[0] = makeAddr("RewardToken");
        mockRewardContract.setRewards(rewards);
        _addBribePoolAsVoting(address(mockRewardContract));

        assertTrue(claimBribesModule.bribePoolExists(address(mockRewardContract)));
    }

    function test_bribePoolExists_returnsFalseForNonExisting() public view {
        assertFalse(claimBribesModule.bribePoolExists(address(0xdead)));
    }
}
