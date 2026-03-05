// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Proxies_Shared_Test} from "tests/unit/proxies/shared/Shared.sol";
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";

contract Unit_Fuzz_Proxy_Initialize_Test is Unit_Proxies_Shared_Test {
    function testFuzz_initialize_anyNonZeroGovernor(address _governor) public {
        vm.assume(_governor != address(0));

        // Deploy a fresh proxy (test contract is governor)
        InitializeGovernedUpgradeabilityProxy freshProxy = new InitializeGovernedUpgradeabilityProxy();

        freshProxy.initialize(address(impl), _governor, bytes(""));

        assertEq(freshProxy.governor(), _governor);
        assertEq(freshProxy.implementation(), address(impl));
    }
}
