// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Proxies_Shared_Test} from "tests/unit/proxies/shared/Shared.t.sol";

// --- Test utilities
import {Proxies} from "tests/utils/artifacts/Proxies.sol";

// --- Project imports
import {IProxy} from "contracts/interfaces/IProxy.sol";

contract Unit_Fuzz_Proxy_Initialize_Test is Unit_Proxies_Shared_Test {
    function testFuzz_initialize_anyNonZeroGovernor(address _governor) public {
        address newGovernor = address(uint160(bound(uint256(uint160(_governor)), 1, type(uint160).max)));

        IProxy freshProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        freshProxy.initialize(address(impl), newGovernor, bytes(""));

        assertEq(freshProxy.governor(), newGovernor);
        assertEq(freshProxy.implementation(), address(impl));
    }
}
