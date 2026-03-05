// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.sol";

import {InitializeGovernedUpgradeabilityProxy} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol";
import {InitializeGovernedUpgradeabilityProxy2} from "contracts/proxies/InitializeGovernedUpgradeabilityProxy2.sol";
import {CrossChainStrategyProxy} from "contracts/proxies/create2/CrossChainStrategyProxy.sol";
import {MockImplementation, MockImplementationV2} from "tests/mocks/MockImplementation.sol";

abstract contract Unit_Proxies_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;
    bytes32 internal constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    InitializeGovernedUpgradeabilityProxy internal proxy;
    InitializeGovernedUpgradeabilityProxy2 internal proxy2;
    CrossChainStrategyProxy internal crossChainProxy;

    MockImplementation internal impl;
    MockImplementationV2 internal implV2;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployImplementations();
        _deployProxies();
        _labelContracts();
    }

    function _deployImplementations() internal {
        impl = new MockImplementation();
        implV2 = new MockImplementationV2();
    }

    function _deployProxies() internal {
        // Deploy proxy as deployer (deployer becomes initial governor)
        vm.startPrank(deployer);
        proxy = new InitializeGovernedUpgradeabilityProxy();
        vm.stopPrank();

        // Deploy proxy2 with explicit governor
        proxy2 = new InitializeGovernedUpgradeabilityProxy2(governor);

        // Deploy crossChainProxy with explicit governor
        crossChainProxy = new CrossChainStrategyProxy(governor);
    }

    function _labelContracts() internal {
        vm.label(address(proxy), "Proxy");
        vm.label(address(proxy2), "Proxy2");
        vm.label(address(crossChainProxy), "CrossChainProxy");
        vm.label(address(impl), "MockImplementation");
        vm.label(address(implV2), "MockImplementationV2");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Initialize the proxy with the mock implementation and governor.
    function _initializeProxy(
        InitializeGovernedUpgradeabilityProxy _proxy,
        address _governor
    ) internal {
        address currentGovernor = _proxy.governor();
        vm.prank(currentGovernor);
        _proxy.initialize(address(impl), _governor, bytes(""));
    }
}
