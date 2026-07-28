// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Fork_BeaconRoots_Shared_Test} from "../shared/Shared.t.sol";

contract Fork_Concrete_BeaconRoots_Read_Test is Fork_BeaconRoots_Shared_Test {
    function test_latestBlockRoot() public view {
        (bytes32 parentRoot, uint64 timestamp) = beaconRoots.latestBlockRoot();

        assertTrue(parentRoot != bytes32(0), "latest parent root should not be zero");
        assertEq(timestamp, uint64(block.timestamp), "latest block timestamp should match fork timestamp");
    }

    function test_parentBlockRoot_currentBlock() public view {
        bytes32 parentRoot = beaconRoots.parentBlockRoot(uint64(block.timestamp));
        assertTrue(parentRoot != bytes32(0), "current block root should not be zero");
    }

    function test_parentBlockRoot_previousBlock() public {
        uint256 currentBlockNumber = block.number;
        uint64 previousTimestamp = _blockTimestamp(currentBlockNumber - 1);

        bytes32 parentRoot = beaconRoots.parentBlockRoot(previousTimestamp);
        assertTrue(parentRoot != bytes32(0), "previous block root should not be zero");
    }

    function test_parentBlockRoot_oldBlock() public {
        uint256 currentBlockNumber = block.number;
        uint64 olderTimestamp = _blockTimestamp(currentBlockNumber - 1000);

        bytes32 parentRoot = beaconRoots.parentBlockRoot(olderTimestamp);
        assertTrue(parentRoot != bytes32(0), "older block root should not be zero");
    }

    function test_parentBlockRoot_RevertWhen_blockIsOlderThanBuffer() public {
        uint256 currentBlockNumber = block.number;
        uint64 oldTimestamp = _blockTimestamp(currentBlockNumber - 10_000);

        vm.expectRevert("Timestamp too old");
        beaconRoots.parentBlockRoot(oldTimestamp);
    }
}
