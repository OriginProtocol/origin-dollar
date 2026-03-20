// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_ClaimBribesSafeModule_Shared_Test} from
    "tests/unit/automation/ClaimBribesSafeModule/shared/Shared.t.sol";

import {ClaimBribesSafeModule} from "contracts/automation/ClaimBribesSafeModule.sol";

contract Unit_Concrete_ClaimBribesSafeModule_RemoveNFTIds_Test is Unit_ClaimBribesSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REMOVE NFT IDS
    //////////////////////////////////////////////////////

    function test_removeNFTIds_removesNFTs() public {
        _addNFT(1);
        _addNFT(2);

        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;

        vm.prank(operator);
        claimBribesModule.removeNFTIds(ids);

        assertEq(claimBribesModule.getNFTIdsLength(), 1);
        assertFalse(claimBribesModule.nftIdExists(1));
        assertTrue(claimBribesModule.nftIdExists(2));
    }

    function test_removeNFTIds_emitsNFTIdRemoved() public {
        _addNFT(1);

        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;

        vm.prank(operator);
        vm.expectEmit(true, true, true, true);
        emit ClaimBribesSafeModule.NFTIdRemoved(1);
        claimBribesModule.removeNFTIds(ids);
    }

    function test_removeNFTIds_skipsNonExistent() public {
        _addNFT(1);

        uint256[] memory ids = new uint256[](1);
        ids[0] = 999; // Does not exist

        vm.prank(operator);
        claimBribesModule.removeNFTIds(ids);

        // Should still have 1 NFT
        assertEq(claimBribesModule.getNFTIdsLength(), 1);
        assertTrue(claimBribesModule.nftIdExists(1));
    }

    function test_removeNFTIds_RevertWhen_notOperator() public {
        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;

        vm.prank(josh);
        vm.expectRevert("Caller is not an operator");
        claimBribesModule.removeNFTIds(ids);
    }
}
