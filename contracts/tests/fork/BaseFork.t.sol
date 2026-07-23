// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

abstract contract BaseFork is Base {
    function _createAndSelectForkMainnet() internal virtual {
        // Check if the MAINNET_PROVIDER_URL is set.
        require(vm.envExists("MAINNET_PROVIDER_URL"), "MAINNET_PROVIDER_URL not set");

        // Create and select a fork.
        forkIdMainnet = vm.envExists("FORK_BLOCK_NUMBER_MAINNET")
            ? vm.createFork("mainnet", vm.envUint("FORK_BLOCK_NUMBER_MAINNET"))
            : vm.createFork("mainnet");
        vm.selectFork(forkIdMainnet);
    }

    function _createAndSelectForkBase() internal virtual {
        // Check if the BASE_PROVIDER_URL is set.
        require(vm.envExists("BASE_PROVIDER_URL"), "BASE_PROVIDER_URL not set");

        // Create and select a fork.
        forkIdBase = vm.envExists("FORK_BLOCK_NUMBER_BASE")
            ? vm.createFork("base", vm.envUint("FORK_BLOCK_NUMBER_BASE"))
            : vm.createFork("base");
        vm.selectFork(forkIdBase);
    }

    function _createAndSelectForkArbitrum() internal virtual {
        // Check if the ARBITRUM_PROVIDER_URL is set.
        require(vm.envExists("ARBITRUM_PROVIDER_URL"), "ARBITRUM_PROVIDER_URL not set");

        // Create and select a fork.
        forkIdArbitrum = vm.envExists("FORK_BLOCK_NUMBER_ARBITRUM")
            ? vm.createFork("arbitrum", vm.envUint("FORK_BLOCK_NUMBER_ARBITRUM"))
            : vm.createFork("arbitrum");
        vm.selectFork(forkIdArbitrum);
    }

    function _createAndSelectForkHyperEVM() internal virtual {
        // Check if the HYPEREVM_PROVIDER_URL is set.
        require(vm.envExists("HYPEREVM_PROVIDER_URL"), "HYPEREVM_PROVIDER_URL not set");

        // Create and select a fork.
        forkIdHyperEVM = vm.envExists("FORK_BLOCK_NUMBER_HYPEREVM")
            ? vm.createFork("hyperevm", vm.envUint("FORK_BLOCK_NUMBER_HYPEREVM"))
            : vm.createFork("hyperevm");
        vm.selectFork(forkIdHyperEVM);
    }
}
