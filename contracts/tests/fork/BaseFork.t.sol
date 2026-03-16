// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

abstract contract BaseFork is Base {
    function _createAndSelectForkMainnet() internal virtual {
        // Check if the MAINNET_URL is set.
        require(vm.envExists("MAINNET_PROVIDER_URL"), "MAINNET_URL not set");

        // Create and select a fork.
        forkIdMainnet = vm.envExists("FORK_BLOCK_NUMBER_MAINNET")
            ? vm.createFork("mainnet", vm.envUint("FORK_BLOCK_NUMBER_MAINNET"))
            : vm.createFork("mainnet");
        vm.selectFork(forkIdMainnet);
    }

    function _createAndSelectForkMainnet(uint256 blockNumber) internal virtual {
        require(vm.envExists("MAINNET_PROVIDER_URL"), "MAINNET_URL not set");
        forkIdMainnet = vm.createFork("mainnet", blockNumber);
        vm.selectFork(forkIdMainnet);
    }

    function _createAndSelectForkBase() internal virtual {
        // Check if the BASE_URL is set.
        require(vm.envExists("BASE_PROVIDER_URL"), "BASE_URL not set");

        // Create and select a fork.
        forkIdBase = vm.envExists("FORK_BLOCK_NUMBER_BASE")
            ? vm.createFork("base", vm.envUint("FORK_BLOCK_NUMBER_BASE"))
            : vm.createFork("base");
        vm.selectFork(forkIdBase);
    }

    function _createAndSelectForkSonic() internal virtual {
        // Check if the SONIC_URL is set.
        require(vm.envExists("SONIC_PROVIDER_URL"), "SONIC_URL not set");

        // Create and select a fork.
        forkIdSonic = vm.envExists("FORK_BLOCK_NUMBER_SONIC")
            ? vm.createFork("sonic", vm.envUint("FORK_BLOCK_NUMBER_SONIC"))
            : vm.createFork("sonic");
        vm.selectFork(forkIdSonic);
    }

    function _createAndSelectForkArbitrum() internal virtual {
        // Check if the ARBITRUM_URL is set.
        require(vm.envExists("ARBITRUM_PROVIDER_URL"), "ARBITRUM_URL not set");

        // Create and select a fork.
        forkIdArbitrum = vm.envExists("FORK_BLOCK_NUMBER_ARBITRUM")
            ? vm.createFork("arbitrum", vm.envUint("FORK_BLOCK_NUMBER_ARBITRUM"))
            : vm.createFork("arbitrum");
        vm.selectFork(forkIdArbitrum);
    }
}
