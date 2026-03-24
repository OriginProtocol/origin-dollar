// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {PoolBoostCentralRegistry} from "contracts/poolBooster/PoolBoostCentralRegistry.sol";
import {PoolBoosterFactoryMerkl} from "contracts/poolBooster/PoolBoosterFactoryMerkl.sol";

abstract contract Smoke_PoolBoostCentralRegistryMainnet_Shared_Test is BaseSmoke {
    PoolBoostCentralRegistry internal centralRegistry;
    PoolBoosterFactoryMerkl internal factoryMerkl;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        centralRegistry = PoolBoostCentralRegistry(resolver.resolve("POOL_BOOST_CENTRAL_REGISTRY"));
        factoryMerkl = PoolBoosterFactoryMerkl(resolver.resolve("POOL_BOOSTER_FACTORY_MERKL"));

        vm.label(address(centralRegistry), "PoolBoostCentralRegistry");
    }
}
