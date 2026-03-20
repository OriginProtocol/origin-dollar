// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.t.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";
import {PoolBoostCentralRegistry} from "contracts/poolBooster/PoolBoostCentralRegistry.sol";

contract Unit_Concrete_PoolBoostCentralRegistry_EmitPoolBoosterCreated_Test is Unit_SwapXSingle_Shared_Test {
    function test_emitPoolBoosterCreated() public {
        address boosterAddr = makeAddr("PoolBooster");

        vm.expectEmit(address(centralRegistry));
        emit IPoolBoostCentralRegistry.PoolBoosterCreated(
            boosterAddr,
            mockAmmPool,
            IPoolBoostCentralRegistry.PoolBoosterType.SwapXSingleBooster,
            address(factorySwapxSingle)
        );

        vm.prank(address(factorySwapxSingle));
        centralRegistry.emitPoolBoosterCreated(
            boosterAddr,
            mockAmmPool,
            IPoolBoostCentralRegistry.PoolBoosterType.SwapXSingleBooster
        );
    }

    function test_emitPoolBoosterCreated_eventData() public {
        address boosterAddr = makeAddr("PoolBooster");
        address ammPool = makeAddr("AmmPool");
        IPoolBoostCentralRegistry.PoolBoosterType boosterType =
            IPoolBoostCentralRegistry.PoolBoosterType.SwapXSingleBooster;

        // Verify all event fields: poolBoosterAddress, ammPoolAddress, poolBoosterType, factoryAddress
        vm.expectEmit(true, true, true, true, address(centralRegistry));
        emit IPoolBoostCentralRegistry.PoolBoosterCreated(
            boosterAddr,
            ammPool,
            boosterType,
            address(factorySwapxSingle)
        );

        vm.prank(address(factorySwapxSingle));
        centralRegistry.emitPoolBoosterCreated(boosterAddr, ammPool, boosterType);
    }

    function test_emitPoolBoosterCreated_RevertWhen_notApprovedFactory() public {
        vm.prank(alice);
        vm.expectRevert("Not an approved factory");
        centralRegistry.emitPoolBoosterCreated(
            makeAddr("PoolBooster"),
            mockAmmPool,
            IPoolBoostCentralRegistry.PoolBoosterType.SwapXSingleBooster
        );
    }
}
