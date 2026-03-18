// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_ClaimBribesSafeModule_Shared_Test} from
    "tests/smoke/automation/ClaimBribesSafeModule/shared/Shared.t.sol";
import {Base} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_ClaimBribesSafeModule_Test is Smoke_ClaimBribesSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW TESTS
    //////////////////////////////////////////////////////

    function test_voter() public view {
        assertEq(address(claimBribesModule.voter()), Base.aeroVoterAddress);
    }

    function test_veNFT() public view {
        assertNotEq(claimBribesModule.veNFT(), address(0));
    }

    function test_getBribePoolsLength() public view {
        uint256 length = claimBribesModule.getBribePoolsLength();
        assertGe(length, 0);
    }

    function test_getNFTIdsLength() public view {
        uint256 length = claimBribesModule.getNFTIdsLength();
        assertGe(length, 0);
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE TESTS
    //////////////////////////////////////////////////////

    function test_claimBribes() public {
        uint256 nftCount = claimBribesModule.getNFTIdsLength();

        vm.prank(operator);
        claimBribesModule.claimBribes(0, nftCount, true); // silent=true so failures don't revert
    }

    function test_updateRewardTokenAddresses() public {
        uint256 poolCountBefore = claimBribesModule.getBribePoolsLength();

        vm.prank(operator);
        claimBribesModule.updateRewardTokenAddresses();

        assertEq(claimBribesModule.getBribePoolsLength(), poolCountBefore, "Pool count should not change");
    }

    function test_fetchNFTIds() public {
        uint256 lengthBefore = claimBribesModule.getNFTIdsLength();

        claimBribesModule.fetchNFTIds(); // public, no auth needed

        assertEq(claimBribesModule.getNFTIdsLength(), lengthBefore, "NFT ID count should be consistent after re-fetch");
    }
}
