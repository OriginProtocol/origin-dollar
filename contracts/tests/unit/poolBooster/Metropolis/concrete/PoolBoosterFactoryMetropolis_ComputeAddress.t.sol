// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Metropolis_Shared_Test} from "tests/unit/poolBooster/Metropolis/shared/Shared.t.sol";

contract Unit_Concrete_PoolBoosterFactoryMetropolis_ComputeAddress_Test is Unit_Metropolis_Shared_Test {
    function test_computeAddress_deterministic() public view {
        address computed1 = factoryMetropolis.computePoolBoosterAddress(mockAmmPool, 1);
        address computed2 = factoryMetropolis.computePoolBoosterAddress(mockAmmPool, 1);
        assertEq(computed1, computed2);
    }

    function test_computeAddress_differentSalt() public view {
        address computed1 = factoryMetropolis.computePoolBoosterAddress(mockAmmPool, 1);
        address computed2 = factoryMetropolis.computePoolBoosterAddress(mockAmmPool, 2);
        assertTrue(computed1 != computed2);
    }

    function test_computeAddress_RevertWhen_zeroPool() public {
        vm.expectRevert("Invalid ammPoolAddress address");
        factoryMetropolis.computePoolBoosterAddress(address(0), 1);
    }

    function test_computeAddress_RevertWhen_zeroSalt() public {
        vm.expectRevert("Invalid salt");
        factoryMetropolis.computePoolBoosterAddress(mockAmmPool, 0);
    }
}
