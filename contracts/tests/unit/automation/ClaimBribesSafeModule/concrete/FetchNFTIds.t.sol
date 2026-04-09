// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_ClaimBribesSafeModule_Shared_Test} from "tests/unit/automation/ClaimBribesSafeModule/shared/Shared.t.sol";

contract Unit_Concrete_ClaimBribesSafeModule_FetchNFTIds_Test is Unit_ClaimBribesSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- FETCH NFT IDS
    //////////////////////////////////////////////////////

    function test_fetchNFTIds_fetchesFromVeNFT() public {
        // Set up veNFT to return tokens for the safe
        uint256[] memory tokenIds = new uint256[](3);
        tokenIds[0] = 10;
        tokenIds[1] = 20;
        tokenIds[2] = 30;
        mockVeNFT.setOwnerTokens(address(mockSafe), tokenIds);

        claimBribesModule.fetchNFTIds();

        assertEq(claimBribesModule.getNFTIdsLength(), 3);
        assertTrue(claimBribesModule.nftIdExists(10));
        assertTrue(claimBribesModule.nftIdExists(20));
        assertTrue(claimBribesModule.nftIdExists(30));
    }

    function test_fetchNFTIds_purgesExistingNFTs() public {
        // Add some NFTs first
        _addNFT(1);
        _addNFT(2);
        assertEq(claimBribesModule.getNFTIdsLength(), 2);

        // Set up veNFT with different tokens
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 99;
        mockVeNFT.setOwnerTokens(address(mockSafe), tokenIds);

        claimBribesModule.fetchNFTIds();

        assertEq(claimBribesModule.getNFTIdsLength(), 1);
        assertTrue(claimBribesModule.nftIdExists(99));
        assertFalse(claimBribesModule.nftIdExists(1));
        assertFalse(claimBribesModule.nftIdExists(2));
    }

    function test_fetchNFTIds_anyoneCanCall() public {
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 42;
        mockVeNFT.setOwnerTokens(address(mockSafe), tokenIds);

        // Call from a random user (not operator, not safe)
        vm.prank(josh);
        claimBribesModule.fetchNFTIds();

        assertEq(claimBribesModule.getNFTIdsLength(), 1);
        assertTrue(claimBribesModule.nftIdExists(42));
    }
}
