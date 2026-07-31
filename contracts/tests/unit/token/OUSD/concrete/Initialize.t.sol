// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.t.sol";

// --- Test utilities
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";

// --- Project imports
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";

contract Unit_Concrete_OUSD_Initialize_Test is Unit_OUSD_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- INITIALIZE
    //////////////////////////////////////////////////////

    function test_initialize_RevertWhen_zeroVaultAddress() public {
        // Deploy a fresh OUSD implementation and proxy (uninitialized)
        IOToken freshImpl = IOToken(vm.deployCode(Tokens.OUSD));
        IProxy freshProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        // Initialize proxy with governor but no OUSD init data
        freshProxy.initialize(address(freshImpl), governor, "");

        // Now call OUSD.initialize with zero vault address
        IOToken freshOusd = IOToken(address(freshProxy));
        vm.prank(governor);
        vm.expectRevert("Zero vault address");
        freshOusd.initialize(address(0), 1e27);
    }

    function test_initialize_RevertWhen_alreadyInitialized() public {
        // The proxy is already initialized in setUp, so calling again should revert
        vm.prank(governor);
        vm.expectRevert("Already initialized");
        ousd.initialize(address(1), 1e27);
    }
}
