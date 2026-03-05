// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Metropolis_Shared_Test} from "tests/unit/poolBooster/Metropolis/shared/Shared.t.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

contract Unit_Concrete_PoolBoosterFactoryMetropolis_CreatePoolBooster_Test is Unit_Metropolis_Shared_Test {
    function test_createPoolBooster() public {
        vm.prank(governor);
        factoryMetropolis.createPoolBoosterMetropolis(mockAmmPool, 1);

        assertEq(factoryMetropolis.poolBoosterLength(), 1);

        (address boosterAddr, address ammPool,) = factoryMetropolis.poolBoosters(0);
        assertTrue(boosterAddr != address(0));
        assertEq(ammPool, mockAmmPool);
    }

    function test_createPoolBooster_matchesComputed() public {
        address computed = factoryMetropolis.computePoolBoosterAddress(mockAmmPool, 1);

        vm.prank(governor);
        factoryMetropolis.createPoolBoosterMetropolis(mockAmmPool, 1);

        (address deployed,,) = factoryMetropolis.poolBoosters(0);
        assertEq(deployed, computed);
    }

    function test_createPoolBooster_event() public {
        address computed = factoryMetropolis.computePoolBoosterAddress(mockAmmPool, 1);

        vm.expectEmit(true, true, true, true, address(centralRegistry));
        emit IPoolBoostCentralRegistry.PoolBoosterCreated(
            computed,
            mockAmmPool,
            IPoolBoostCentralRegistry.PoolBoosterType.MetropolisBooster,
            address(factoryMetropolis)
        );

        vm.prank(governor);
        factoryMetropolis.createPoolBoosterMetropolis(mockAmmPool, 1);
    }

    function test_createPoolBooster_correctType() public {
        vm.prank(governor);
        factoryMetropolis.createPoolBoosterMetropolis(mockAmmPool, 1);

        (,, IPoolBoostCentralRegistry.PoolBoosterType boosterType) = factoryMetropolis.poolBoosters(0);
        assertEq(uint256(boosterType), uint256(IPoolBoostCentralRegistry.PoolBoosterType.MetropolisBooster));
    }

    function test_createPoolBooster_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        factoryMetropolis.createPoolBoosterMetropolis(mockAmmPool, 1);
    }

    function test_createPoolBooster_RevertWhen_zeroPool() public {
        vm.prank(governor);
        vm.expectRevert("Invalid ammPoolAddress address");
        factoryMetropolis.createPoolBoosterMetropolis(address(0), 1);
    }

    function test_createPoolBooster_RevertWhen_zeroSalt() public {
        vm.prank(governor);
        vm.expectRevert("Invalid salt");
        factoryMetropolis.createPoolBoosterMetropolis(mockAmmPool, 0);
    }
}
