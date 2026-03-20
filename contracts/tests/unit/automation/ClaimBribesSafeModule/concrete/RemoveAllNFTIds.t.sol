// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_ClaimBribesSafeModule_Shared_Test} from
    "tests/unit/automation/ClaimBribesSafeModule/shared/Shared.t.sol";

import {ClaimBribesSafeModule} from "contracts/automation/ClaimBribesSafeModule.sol";

contract Unit_Concrete_ClaimBribesSafeModule_RemoveAllNFTIds_Test is Unit_ClaimBribesSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REMOVE ALL NFT IDS
    //////////////////////////////////////////////////////

    function test_removeAllNFTIds_clearsAll() public {
        _addNFT(1);
        _addNFT(2);
        _addNFT(3);
        assertEq(claimBribesModule.getNFTIdsLength(), 3);

        vm.prank(operator);
        claimBribesModule.removeAllNFTIds();

        assertEq(claimBribesModule.getNFTIdsLength(), 0);
        assertFalse(claimBribesModule.nftIdExists(1));
        assertFalse(claimBribesModule.nftIdExists(2));
        assertFalse(claimBribesModule.nftIdExists(3));
    }

    function test_removeAllNFTIds_emitsNFTIdRemovedForEach() public {
        _addNFT(1);
        _addNFT(2);

        vm.prank(operator);
        vm.expectEmit(true, true, true, true);
        emit ClaimBribesSafeModule.NFTIdRemoved(1);
        vm.expectEmit(true, true, true, true);
        emit ClaimBribesSafeModule.NFTIdRemoved(2);
        claimBribesModule.removeAllNFTIds();
    }

    function test_removeAllNFTIds_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not an operator");
        claimBribesModule.removeAllNFTIds();
    }
}
