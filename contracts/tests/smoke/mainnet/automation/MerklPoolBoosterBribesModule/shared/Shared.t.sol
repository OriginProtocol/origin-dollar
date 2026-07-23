// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

import {IMerklPoolBoosterBribesModule} from "contracts/interfaces/automation/IMerklPoolBoosterBribesModule.sol";
import {IPoolBoosterFactoryMerkl} from "contracts/interfaces/poolBooster/IPoolBoosterFactoryMerkl.sol";

abstract contract Smoke_Mainnet_MerklPoolBoosterBribesModule_Shared_Test is BaseSmoke {
    IMerklPoolBoosterBribesModule internal module;
    IPoolBoosterFactoryMerkl internal factory;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        module = IMerklPoolBoosterBribesModule(resolver.resolve("MERKL_POOL_BOOSTER_BRIBES_MODULE"));
        factory = IPoolBoosterFactoryMerkl(module.factory());
    }

    function _allPoolBoosters() internal view returns (address[] memory boosters) {
        boosters = new address[](factory.poolBoosterLength());
        for (uint256 i; i < boosters.length; i++) {
            (boosters[i],,) = factory.poolBoosters(i);
        }
    }
}
