// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {IPoolBoostCentralRegistryFull} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistryFull.sol";
import {IPoolBoosterFactoryMerkl} from "contracts/interfaces/poolBooster/IPoolBoosterFactoryMerkl.sol";

abstract contract Smoke_PoolBoostCentralRegistryMainnet_Shared_Test is BaseSmoke {
    IPoolBoostCentralRegistryFull internal centralRegistry;
    IPoolBoosterFactoryMerkl internal factoryMerkl;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        centralRegistry = IPoolBoostCentralRegistryFull(resolver.resolve("POOL_BOOST_CENTRAL_REGISTRY"));
        factoryMerkl = IPoolBoosterFactoryMerkl(resolver.resolve("POOL_BOOSTER_FACTORY_MERKL"));

        vm.label(address(centralRegistry), "PoolBoostCentralRegistry");
    }
}
