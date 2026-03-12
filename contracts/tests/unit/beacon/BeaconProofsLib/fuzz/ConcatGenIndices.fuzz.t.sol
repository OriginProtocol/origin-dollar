// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Fuzz_BeaconProofsLib_ConcatGenIndices_Test is Unit_BeaconProofsLib_Shared_Test {
    function testFuzz_concatGenIndices_formula(uint64 genIndex, uint8 height, uint64 index) public view {
        // Bound height to avoid overflow (max 64 bits of shift for safe uint256)
        vm.assume(height < 64);
        // Ensure genIndex > 0 (generalized indices start at 1)
        vm.assume(genIndex > 0);
        // Ensure index fits within the height
        vm.assume(index < (uint256(1) << height));

        uint256 result = beaconProofs.concatGenIndices(genIndex, height, index);
        assertEq(result, (uint256(genIndex) << height) | index);
    }

    function testFuzz_concatGenIndices_zeroIndex(uint64 genIndex, uint8 height) public view {
        vm.assume(height < 64);
        vm.assume(genIndex > 0);

        uint256 result = beaconProofs.concatGenIndices(genIndex, height, 0);
        // Zero index means pure left shift
        assertEq(result, uint256(genIndex) << height);
    }
}
