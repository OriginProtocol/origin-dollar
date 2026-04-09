// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.t.sol";

// --- Test utilities
import {PoolBoosters} from "tests/utils/Artifacts.sol";

import {IPoolBoostCentralRegistryFull} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistryFull.sol";

contract Unit_Concrete_PoolBoostCentralRegistry_ViewFunctions_Test is Unit_SwapXSingle_Shared_Test {
    function test_isApprovedFactory_true() public view {
        // factorySwapxSingle is approved in setUp
        assertTrue(centralRegistry.isApprovedFactory(address(factorySwapxSingle)));
    }

    function test_isApprovedFactory_false() public view {
        assertFalse(centralRegistry.isApprovedFactory(alice));
    }

    function test_getAllFactories_empty() public {
        IPoolBoostCentralRegistryFull freshRegistry =
            IPoolBoostCentralRegistryFull(vm.deployCode(PoolBoosters.POOL_BOOST_CENTRAL_REGISTRY));

        address[] memory factories = freshRegistry.getAllFactories();
        assertEq(factories.length, 0);
    }

    function test_getAllFactories_populated() public {
        // setUp approves factorySwapxSingle; add two more for a multi-factory test
        address factory2 = makeAddr("Factory2");
        address factory3 = makeAddr("Factory3");
        vm.startPrank(governor);
        centralRegistry.approveFactory(factory2);
        centralRegistry.approveFactory(factory3);
        vm.stopPrank();

        address[] memory factories = centralRegistry.getAllFactories();
        assertEq(factories.length, 3);
        assertEq(factories[0], address(factorySwapxSingle));
        assertEq(factories[1], factory2);
        assertEq(factories[2], factory3);
    }
}
