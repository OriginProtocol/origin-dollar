// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.t.sol";

// --- Test utilities
import {PoolBoosters} from "tests/utils/Artifacts.sol";

import {IPoolBoostCentralRegistryFull} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistryFull.sol";

contract Unit_Concrete_PoolBoostCentralRegistry_ApproveFactory_Test is Unit_SwapXSingle_Shared_Test {
    function test_approveFactory() public {
        IPoolBoostCentralRegistryFull freshRegistry =
            IPoolBoostCentralRegistryFull(vm.deployCode(PoolBoosters.POOL_BOOST_CENTRAL_REGISTRY));
        _setGovernorViaSlot(address(freshRegistry), governor);

        address newFactory = makeAddr("NewFactory");

        vm.prank(governor);
        freshRegistry.approveFactory(newFactory);

        assertTrue(freshRegistry.isApprovedFactory(newFactory));
    }

    function test_approveMultipleFactories() public {
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
        vm.stopPrank();

        address[] memory factories = freshRegistry.getAllFactories();
        assertEq(factories.length, 3);
        assertEq(factories[0], factoryA);
        assertEq(factories[1], factoryB);
        assertEq(factories[2], factoryC);
    }

    function test_approveFactory_event() public {
        IPoolBoostCentralRegistryFull freshRegistry =
            IPoolBoostCentralRegistryFull(vm.deployCode(PoolBoosters.POOL_BOOST_CENTRAL_REGISTRY));
        _setGovernorViaSlot(address(freshRegistry), governor);

        address newFactory = makeAddr("NewFactory");

        vm.expectEmit(address(freshRegistry));
        emit IPoolBoostCentralRegistryFull.FactoryApproved(newFactory);

        vm.prank(governor);
        freshRegistry.approveFactory(newFactory);
    }

    function test_approveFactory_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        centralRegistry.approveFactory(makeAddr("NewFactory"));
    }

    function test_approveFactory_RevertWhen_zeroAddress() public {
        vm.prank(governor);
        vm.expectRevert("Invalid address");
        centralRegistry.approveFactory(address(0));
    }

    function test_approveFactory_RevertWhen_duplicate() public {
        // factorySwapxSingle is already approved in setUp
        vm.prank(governor);
        vm.expectRevert("Factory already approved");
        centralRegistry.approveFactory(address(factorySwapxSingle));
    }
}
