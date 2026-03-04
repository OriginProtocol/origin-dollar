// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";
import {PoolBoostCentralRegistry} from "contracts/poolBooster/PoolBoostCentralRegistry.sol";

contract Unit_Concrete_PoolBoostCentralRegistry_Constructor_Test is Unit_SwapXSingle_Shared_Test {
    function test_constructor_governorIsZeroAddress() public {
        PoolBoostCentralRegistry freshRegistry = new PoolBoostCentralRegistry();
        assertEq(freshRegistry.governor(), address(0));
    }

    function test_constructor_getAllFactoriesIsEmpty() public {
        PoolBoostCentralRegistry freshRegistry = new PoolBoostCentralRegistry();
        address[] memory factories = freshRegistry.getAllFactories();
        assertEq(factories.length, 0);
    }
}
