// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.t.sol";

// --- Test utilities
import {PoolBoosters} from "tests/utils/artifacts/PoolBoosters.sol";

// --- Project imports
import {IPoolBoostCentralRegistryFull} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistryFull.sol";

contract Unit_Concrete_PoolBoostCentralRegistry_Constructor_Test is Unit_SwapXSingle_Shared_Test {
    function test_constructor_governorIsZeroAddress() public {
        IPoolBoostCentralRegistryFull freshRegistry =
            IPoolBoostCentralRegistryFull(vm.deployCode(PoolBoosters.POOL_BOOST_CENTRAL_REGISTRY));
        assertEq(freshRegistry.governor(), address(0));
    }

    function test_constructor_getAllFactoriesIsEmpty() public {
        IPoolBoostCentralRegistryFull freshRegistry =
            IPoolBoostCentralRegistryFull(vm.deployCode(PoolBoosters.POOL_BOOST_CENTRAL_REGISTRY));
        address[] memory factories = freshRegistry.getAllFactories();
        assertEq(factories.length, 0);
    }
}
