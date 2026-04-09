// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Project imports
import {IPoolBoostCentralRegistryFull} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistryFull.sol";
import {IPoolBoosterFactorySwapxSingle} from "contracts/interfaces/poolBooster/IPoolBoosterFactorySwapxSingle.sol";

abstract contract Smoke_PoolBoostCentralRegistrySonic_Shared_Test is BaseSmoke {
    IPoolBoostCentralRegistryFull internal centralRegistry;
    IPoolBoosterFactorySwapxSingle internal factorySwapxSingle;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkSonic();
        _igniteDeployManager();
        _fetchContracts();
        _labelContracts();
    }

    function _fetchContracts() internal virtual {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        centralRegistry = IPoolBoostCentralRegistryFull(resolver.resolve("POOL_BOOST_CENTRAL_REGISTRY"));
        factorySwapxSingle = IPoolBoosterFactorySwapxSingle(resolver.resolve("POOL_BOOSTER_FACTORY_SWAPX_SINGLE"));
    }

    function _labelContracts() internal virtual {
        vm.label(address(centralRegistry), "PoolBoostCentralRegistry");
        vm.label(address(factorySwapxSingle), "PoolBoosterFactorySwapxSingle");
    }
}
