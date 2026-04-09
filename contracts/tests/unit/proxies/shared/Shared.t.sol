// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Proxies} from "tests/utils/artifacts/Proxies.sol";

import {IProxy} from "contracts/interfaces/IProxy.sol";
import {MockImplementation, MockImplementationV2} from "tests/mocks/MockImplementation.sol";

abstract contract Unit_Proxies_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IProxy internal proxy;
    IProxy internal proxy2;
    IProxy internal crossChainProxy;

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
        vm.startPrank(deployer);
        proxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        vm.stopPrank();

        proxy2 = IProxy(vm.deployCode(Proxies.IG_PROXY_2, abi.encode(governor)));

        crossChainProxy = IProxy(vm.deployCode(Proxies.CROSS_CHAIN_STRATEGY_PROXY, abi.encode(governor)));
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
    function _initializeProxy(IProxy _proxy, address _governor) internal {
        address currentGovernor = _proxy.governor();
        vm.prank(currentGovernor);
        _proxy.initialize(address(impl), _governor, bytes(""));
    }
}
