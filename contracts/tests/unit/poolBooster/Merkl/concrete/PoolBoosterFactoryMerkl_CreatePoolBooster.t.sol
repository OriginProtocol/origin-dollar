// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.t.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

contract Unit_Concrete_PoolBoosterFactoryMerkl_CreatePoolBooster_Test is Unit_Merkl_Shared_Test {
    function test_createPoolBooster() public {
        vm.prank(governor);
        factoryMerkl.createPoolBoosterMerkl(mockAmmPool, _defaultInitData(), 1);

        assertEq(factoryMerkl.poolBoosterLength(), 1);

        (address boosterAddr, address ammPool,) = factoryMerkl.poolBoosters(0);
        assertTrue(boosterAddr != address(0));
        assertEq(ammPool, mockAmmPool);
    }

    function test_createPoolBooster_matchesComputed() public {
        address computed = factoryMerkl.computePoolBoosterAddress(1, _defaultInitData());

        vm.prank(governor);
        factoryMerkl.createPoolBoosterMerkl(mockAmmPool, _defaultInitData(), 1);

        (address deployed,,) = factoryMerkl.poolBoosters(0);
        assertEq(deployed, computed);
    }

    function test_createPoolBooster_event() public {
        address computed = factoryMerkl.computePoolBoosterAddress(1, _defaultInitData());

        vm.expectEmit(true, true, true, true, address(centralRegistry));
        emit IPoolBoostCentralRegistry.PoolBoosterCreated(
            computed, mockAmmPool, IPoolBoostCentralRegistry.PoolBoosterType.MerklBooster, address(factoryMerkl)
        );

        vm.prank(governor);
        factoryMerkl.createPoolBoosterMerkl(mockAmmPool, _defaultInitData(), 1);
    }

    function test_createPoolBooster_correctType() public {
        vm.prank(governor);
        factoryMerkl.createPoolBoosterMerkl(mockAmmPool, _defaultInitData(), 1);

        (,, IPoolBoostCentralRegistry.PoolBoosterType boosterType) = factoryMerkl.poolBoosters(0);
        assertEq(uint256(boosterType), uint256(IPoolBoostCentralRegistry.PoolBoosterType.MerklBooster));
    }

    function test_createPoolBooster_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        factoryMerkl.createPoolBoosterMerkl(mockAmmPool, _defaultInitData(), 1);
    }

    function test_createPoolBooster_RevertWhen_zeroPool() public {
        vm.prank(governor);
        vm.expectRevert("Invalid ammPoolAddress address");
        factoryMerkl.createPoolBoosterMerkl(address(0), _defaultInitData(), 1);
    }

    function test_createPoolBooster_RevertWhen_zeroSalt() public {
        vm.prank(governor);
        vm.expectRevert("Invalid salt");
        factoryMerkl.createPoolBoosterMerkl(mockAmmPool, _defaultInitData(), 0);
    }
}
