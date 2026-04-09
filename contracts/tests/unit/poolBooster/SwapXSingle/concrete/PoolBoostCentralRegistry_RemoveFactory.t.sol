// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.t.sol";

// --- Test utilities
import {PoolBoosters} from "tests/utils/artifacts/PoolBoosters.sol";

import {IPoolBoostCentralRegistryFull} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistryFull.sol";

contract Unit_Concrete_PoolBoostCentralRegistry_RemoveFactory_Test is Unit_SwapXSingle_Shared_Test {
    function test_removeFactory() public {
        IPoolBoostCentralRegistryFull freshRegistry =
            IPoolBoostCentralRegistryFull(vm.deployCode(PoolBoosters.POOL_BOOST_CENTRAL_REGISTRY));
        _setGovernorViaSlot(address(freshRegistry), governor);

        address factory = makeAddr("Factory");

        vm.startPrank(governor);
        freshRegistry.approveFactory(factory);
        assertTrue(freshRegistry.isApprovedFactory(factory));

        freshRegistry.removeFactory(factory);
        vm.stopPrank();

        assertFalse(freshRegistry.isApprovedFactory(factory));
    }

    function test_removeFactory_swapAndPop() public {
        IPoolBoostCentralRegistryFull freshRegistry =
            IPoolBoostCentralRegistryFull(vm.deployCode(PoolBoosters.POOL_BOOST_CENTRAL_REGISTRY));
        _setGovernorViaSlot(address(freshRegistry), governor);

        address factoryA = makeAddr("FactoryA");
        address factoryB = makeAddr("FactoryB");
        address factoryC = makeAddr("FactoryC");

        vm.startPrank(governor);
        freshRegistry.approveFactory(factoryA);
        freshRegistry.approveFactory(factoryB);
        freshRegistry.approveFactory(factoryC);

        // Remove B (middle element) -- C should be swapped into B's slot
        freshRegistry.removeFactory(factoryB);
        vm.stopPrank();

        address[] memory factories = freshRegistry.getAllFactories();
        assertEq(factories.length, 2);
        assertEq(factories[0], factoryA);
        assertEq(factories[1], factoryC); // C swapped into B's slot
        assertFalse(freshRegistry.isApprovedFactory(factoryB));
    }

    function test_removeFactory_lastElement() public {
        IPoolBoostCentralRegistryFull freshRegistry =
            IPoolBoostCentralRegistryFull(vm.deployCode(PoolBoosters.POOL_BOOST_CENTRAL_REGISTRY));
        _setGovernorViaSlot(address(freshRegistry), governor);

        address factoryA = makeAddr("FactoryA");
        address factoryB = makeAddr("FactoryB");

        vm.startPrank(governor);
        freshRegistry.approveFactory(factoryA);
        freshRegistry.approveFactory(factoryB);

        // Remove the last element
        freshRegistry.removeFactory(factoryB);
        vm.stopPrank();

        address[] memory factories = freshRegistry.getAllFactories();
        assertEq(factories.length, 1);
        assertEq(factories[0], factoryA);
        assertFalse(freshRegistry.isApprovedFactory(factoryB));
    }

    function test_removeFactory_emitsEventTwice() public {
        // Known bug: removeFactory emits FactoryRemoved twice (line 60 and 66)
        IPoolBoostCentralRegistryFull freshRegistry =
            IPoolBoostCentralRegistryFull(vm.deployCode(PoolBoosters.POOL_BOOST_CENTRAL_REGISTRY));
        _setGovernorViaSlot(address(freshRegistry), governor);

        address factory = makeAddr("Factory");

        vm.prank(governor);
        freshRegistry.approveFactory(factory);

        // Expect the event to be emitted twice due to the known bug
        vm.expectEmit(address(freshRegistry));
        emit IPoolBoostCentralRegistryFull.FactoryRemoved(factory);
        vm.expectEmit(address(freshRegistry));
        emit IPoolBoostCentralRegistryFull.FactoryRemoved(factory);

        vm.prank(governor);
        freshRegistry.removeFactory(factory);
    }

    function test_removeFactory_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        centralRegistry.removeFactory(address(factorySwapxSingle));
    }

    function test_removeFactory_RevertWhen_zeroAddress() public {
        vm.prank(governor);
        vm.expectRevert("Invalid address");
        centralRegistry.removeFactory(address(0));
    }

    function test_removeFactory_RevertWhen_notApproved() public {
        address notApproved = makeAddr("NotApproved");

        vm.prank(governor);
        vm.expectRevert("Not an approved factory");
        centralRegistry.removeFactory(notApproved);
    }
}
