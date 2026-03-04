// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

contract Unit_Concrete_PoolBoosterFactoryMerkl_CreatePoolBooster_Test is Unit_Merkl_Shared_Test {
    function test_createPoolBooster() public {
        vm.prank(governor);
        factoryMerkl.createPoolBoosterMerkl(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 1
        );

        assertEq(factoryMerkl.poolBoosterLength(), 1);

        (address boosterAddr, address ammPool,) = factoryMerkl.poolBoosters(0);
        assertTrue(boosterAddr != address(0));
        assertEq(ammPool, mockAmmPool);
    }

    function test_createPoolBooster_matchesComputed() public {
        address computed = factoryMerkl.computePoolBoosterAddress(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 1
        );

        vm.prank(governor);
        factoryMerkl.createPoolBoosterMerkl(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 1
        );

        (address deployed,,) = factoryMerkl.poolBoosters(0);
        assertEq(deployed, computed);
    }

    function test_createPoolBooster_event() public {
        address computed = factoryMerkl.computePoolBoosterAddress(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 1
        );

        vm.expectEmit(true, true, true, true, address(centralRegistry));
        emit IPoolBoostCentralRegistry.PoolBoosterCreated(
            computed,
            mockAmmPool,
            IPoolBoostCentralRegistry.PoolBoosterType.MerklBooster,
            address(factoryMerkl)
        );

        vm.prank(governor);
        factoryMerkl.createPoolBoosterMerkl(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 1
        );
    }

    function test_createPoolBooster_correctType() public {
        vm.prank(governor);
        factoryMerkl.createPoolBoosterMerkl(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 1
        );

        (,, IPoolBoostCentralRegistry.PoolBoosterType boosterType) = factoryMerkl.poolBoosters(0);
        assertEq(uint256(boosterType), uint256(IPoolBoostCentralRegistry.PoolBoosterType.MerklBooster));
    }

    function test_createPoolBooster_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        factoryMerkl.createPoolBoosterMerkl(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 1
        );
    }

    function test_createPoolBooster_RevertWhen_zeroPool() public {
        vm.prank(governor);
        vm.expectRevert("Invalid ammPoolAddress address");
        factoryMerkl.createPoolBoosterMerkl(
            DEFAULT_CAMPAIGN_TYPE, address(0), DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 1
        );
    }

    function test_createPoolBooster_RevertWhen_zeroSalt() public {
        vm.prank(governor);
        vm.expectRevert("Invalid salt");
        factoryMerkl.createPoolBoosterMerkl(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 0
        );
    }

    function test_createPoolBooster_RevertWhen_invalidDuration() public {
        vm.prank(governor);
        vm.expectRevert("Invalid campaign duration");
        factoryMerkl.createPoolBoosterMerkl(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, 3600, DEFAULT_CAMPAIGN_DATA, 1
        );
    }

    function test_createPoolBooster_RevertWhen_emptyData() public {
        vm.prank(governor);
        vm.expectRevert("Invalid campaign data");
        factoryMerkl.createPoolBoosterMerkl(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, "", 1
        );
    }
}
