// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_ClaimBribesSafeModule_Shared_Test} from "tests/unit/automation/ClaimBribesSafeModule/shared/Shared.t.sol";
import {IClaimBribesSafeModule} from "contracts/interfaces/automation/IClaimBribesSafeModule.sol";

contract Unit_Concrete_ClaimBribesSafeModule_AddNFTIds_Test is Unit_ClaimBribesSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ADD NFT IDS
    //////////////////////////////////////////////////////

    function test_addNFTIds_addsNFTs() public {
        mockVeNFT.setOwner(1, address(mockSafe));
        mockVeNFT.setOwner(2, address(mockSafe));

        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;

        vm.prank(operator);
        claimBribesModule.addNFTIds(ids);

        assertEq(claimBribesModule.getNFTIdsLength(), 2);
        assertTrue(claimBribesModule.nftIdExists(1));
        assertTrue(claimBribesModule.nftIdExists(2));
    }

    function test_addNFTIds_emitsNFTIdAdded() public {
        mockVeNFT.setOwner(1, address(mockSafe));

        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;

        vm.prank(operator);
        vm.expectEmit(true, true, true, true);
        emit IClaimBribesSafeModule.NFTIdAdded(1);
        claimBribesModule.addNFTIds(ids);
    }

    function test_addNFTIds_skipsExisting() public {
        _addNFT(1);

        // Try to add same NFT again
        mockVeNFT.setOwner(1, address(mockSafe));
        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;

        vm.prank(operator);
        claimBribesModule.addNFTIds(ids);

        // Should still be 1
        assertEq(claimBribesModule.getNFTIdsLength(), 1);
    }

    function test_addNFTIds_RevertWhen_notOwnedBySafe() public {
        mockVeNFT.setOwner(1, josh);

        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;

        vm.prank(operator);
        vm.expectRevert("NFT not owned by safe");
        claimBribesModule.addNFTIds(ids);
    }

    function test_addNFTIds_RevertWhen_notOperator() public {
        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;

        vm.prank(josh);
        vm.expectRevert("Caller is not an operator");
        claimBribesModule.addNFTIds(ids);
    }
}
