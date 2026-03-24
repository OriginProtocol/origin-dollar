// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Sonic} from "tests/utils/Addresses.sol";

import {PoolBoostCentralRegistry} from "contracts/poolBooster/PoolBoostCentralRegistry.sol";
import {PoolBoosterFactorySwapxSingle} from "contracts/poolBooster/PoolBoosterFactorySwapxSingle.sol";

abstract contract Smoke_PoolBoostCentralRegistrySonic_Shared_Test is BaseSmoke {
    PoolBoostCentralRegistry internal centralRegistry;
    PoolBoosterFactorySwapxSingle internal factorySwapxSingle;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkSonic();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        centralRegistry = PoolBoostCentralRegistry(resolver.resolve("POOL_BOOST_CENTRAL_REGISTRY"));
        factorySwapxSingle = PoolBoosterFactorySwapxSingle(resolver.resolve("POOL_BOOSTER_FACTORY_SWAPX_SINGLE"));

        vm.label(address(centralRegistry), "PoolBoostCentralRegistry");
    }
}
