// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.t.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

contract Unit_Concrete_PoolBoostCentralRegistry_EmitPoolBoosterRemoved_Test is Unit_SwapXSingle_Shared_Test {
    function test_emitPoolBoosterRemoved() public {
        address boosterAddr = makeAddr("PoolBooster");

        vm.expectEmit(address(centralRegistry));
        emit IPoolBoostCentralRegistry.PoolBoosterRemoved(boosterAddr);

        vm.prank(address(factorySwapxSingle));
        centralRegistry.emitPoolBoosterRemoved(boosterAddr);
    }

    function test_emitPoolBoosterRemoved_RevertWhen_notApprovedFactory() public {
        vm.prank(alice);
        vm.expectRevert("Not an approved factory");
        centralRegistry.emitPoolBoosterRemoved(makeAddr("PoolBooster"));
    }
}
