// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {Mainnet} from "tests/utils/Addresses.sol";
import {MockBeaconRoots} from "contracts/mocks/beacon/MockBeaconRoots.sol";

abstract contract Fork_BeaconRoots_Shared_Test is BaseFork {
    using stdJson for string;

    MockBeaconRoots internal beaconRoots;

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();

        // This suite mirrors the Hardhat test's live-mainnet behavior.
        // If the repo env pins mainnet globally, roll the selected fork forward here.
        if (vm.envExists("FORK_BLOCK_NUMBER_MAINNET")) {
            vm.rollFork(forkIdMainnet, _latestMainnetBlockNumber());
        }

        // Use the deployed wrapper contract on mainnet, matching the Hardhat test.
        beaconRoots = MockBeaconRoots(Mainnet.mockBeaconRoots);

        vm.label(address(beaconRoots), "BeaconRoots");
    }

    function _blockTimestamp(uint256 blockNumber) internal returns (uint64) {
        string[] memory cmd = new string[](3);
        cmd[0] = "/bin/zsh";
        cmd[1] = "-lc";
        cmd[2] = string.concat("cast block ", vm.toString(blockNumber), " --json --rpc-url \"$MAINNET_PROVIDER_URL\"");

        string memory response = string(vm.ffi(cmd));
        string memory timestampHex = response.readString(".timestamp");
        return uint64(vm.parseUint(timestampHex));
    }

    function _latestMainnetBlockNumber() internal returns (uint256) {
        string[] memory cmd = new string[](3);
        cmd[0] = "/bin/zsh";
        cmd[1] = "-lc";
        cmd[2] = "cast block latest --json --rpc-url \"$MAINNET_PROVIDER_URL\"";

        string memory response = string(vm.ffi(cmd));
        string memory blockNumberHex = response.readString(".number");
        return vm.parseUint(blockNumberHex);
    }
}
