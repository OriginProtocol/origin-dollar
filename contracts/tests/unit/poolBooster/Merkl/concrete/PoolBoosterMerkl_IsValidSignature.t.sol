// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.sol";

contract Unit_Concrete_PoolBoosterMerkl_IsValidSignature_Test is Unit_Merkl_Shared_Test {
    function test_isValidSignature() public {
        vm.prank(mockMerklDistributor);
        bytes4 result = boosterMerkl.isValidSignature(bytes32(0), bytes(""));
        assertEq(result, bytes4(0x1626ba7e));
    }

    function test_isValidSignature_RevertWhen_notDistributor() public {
        vm.prank(alice);
        vm.expectRevert("Invalid sender");
        boosterMerkl.isValidSignature(bytes32(0), bytes(""));
    }
}
