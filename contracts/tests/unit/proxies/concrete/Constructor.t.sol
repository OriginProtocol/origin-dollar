// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Proxies_Shared_Test} from "tests/unit/proxies/shared/Shared.t.sol";
import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";
import {InitializeGovernedUpgradeabilityProxy2} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy2.sol";
import {CrossChainStrategyProxy} from "contracts/proxies/create2/CrossChainStrategyProxy.sol";

contract Unit_Concrete_Proxy_Constructor_Test is Unit_Proxies_Shared_Test {
    // --- InitializeGovernedUpgradeabilityProxy ---

    function test_constructor_setsDeployerAsGovernor() public view {
        assertEq(proxy.governor(), deployer);
    }

    function test_constructor_implementationIsZero() public view {
        assertEq(proxy.implementation(), address(0));
    }

    // --- InitializeGovernedUpgradeabilityProxy2 ---

    function test_proxy2_constructor_setsGovernorParam() public view {
        assertEq(proxy2.governor(), governor);
    }

    function test_proxy2_constructor_implementationIsZero() public view {
        assertEq(proxy2.implementation(), address(0));
    }

    // --- CrossChainStrategyProxy ---

    function test_crossChainProxy_constructor_setsGovernorParam() public view {
        assertEq(crossChainProxy.governor(), governor);
    }

    function test_crossChainProxy_constructor_implementationIsZero() public view {
        assertEq(crossChainProxy.implementation(), address(0));
    }
}
