// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {Automation} from "tests/utils/artifacts/Automation.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {IMerklPoolBoosterBribesModule} from "contracts/interfaces/automation/IMerklPoolBoosterBribesModule.sol";
import {IPoolBoosterFactoryMerkl} from "contracts/interfaces/poolBooster/IPoolBoosterFactoryMerkl.sol";

abstract contract Fork_Mainnet_MerklPoolBoosterBribesModule_Shared_Test is BaseFork {
    IMerklPoolBoosterBribesModule internal module;
    IPoolBoosterFactoryMerkl internal factory;
    address internal safe;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();

        IMerklPoolBoosterBribesModule deployedModule =
            IMerklPoolBoosterBribesModule(Mainnet.MerklPoolBoosterBribesModule);
        safe = address(deployedModule.safeContract());
        factory = IPoolBoosterFactoryMerkl(deployedModule.factory());
        module = IMerklPoolBoosterBribesModule(
            vm.deployCode(Automation.MERKL_POOL_BOOSTER_BRIBES_MODULE, abi.encode(safe, operator, address(factory)))
        );

        vm.prank(safe);
        (bool success,) = safe.call(abi.encodeWithSignature("enableModule(address)", address(module)));
        require(success, "Failed to enable module");
    }

    function _allPoolBoosters() internal view returns (address[] memory boosters) {
        boosters = new address[](factory.poolBoosterLength());
        for (uint256 i; i < boosters.length; i++) {
            (boosters[i],,) = factory.poolBoosters(i);
        }
    }
}
