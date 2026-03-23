// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {PoolBoostCentralRegistry} from "contracts/poolBooster/PoolBoostCentralRegistry.sol";

import {
    Smoke_PoolBoostCentralRegistrySonic_Shared_Test
} from "tests/smoke/sonic/poolBooster/PoolBoostCentralRegistrySonic/shared/Shared.t.sol";

contract Smoke_Concrete_PoolBoostCentralRegistrySonic_Test is Smoke_PoolBoostCentralRegistrySonic_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_governor() public view {
        assertNotEq(centralRegistry.governor(), address(0));
    }

    function test_getAllFactories() public view {
        address[] memory factories = centralRegistry.getAllFactories();
        assertGt(factories.length, 0);
    }

    function test_isApprovedFactory() public view {
        assertTrue(centralRegistry.isApprovedFactory(address(factorySwapxSingle)));
    }

    function test_factories() public view {
        address[] memory factories = centralRegistry.getAllFactories();
        assertNotEq(factories[0], address(0));
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////

    function test_approveFactory() public {
        address newFactory = address(uint160(uint256(keccak256("newFactory"))));

        vm.prank(centralRegistry.governor());
        centralRegistry.approveFactory(newFactory);

        assertTrue(centralRegistry.isApprovedFactory(newFactory));
    }

    function test_removeFactory() public {
        address[] memory factories = centralRegistry.getAllFactories();
        address factoryToRemove = factories[0];

        vm.prank(centralRegistry.governor());
        centralRegistry.removeFactory(factoryToRemove);

        assertFalse(centralRegistry.isApprovedFactory(factoryToRemove));
    }
}
