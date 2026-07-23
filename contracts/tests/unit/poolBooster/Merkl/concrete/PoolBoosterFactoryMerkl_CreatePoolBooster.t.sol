// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.t.sol";

// --- Project imports
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";
import {IPoolBoosterMerkl} from "contracts/interfaces/poolBooster/IPoolBoosterMerkl.sol";

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

    function test_createPoolBooster_initializesProxy() public {
        vm.prank(governor);
        factoryMerkl.createPoolBoosterMerkl(mockAmmPool, _defaultInitData(), 1);

        (address deployed,,) = factoryMerkl.poolBoosters(0);
        IPoolBoosterMerkl booster = IPoolBoosterMerkl(deployed);

        assertEq(booster.duration(), DEFAULT_CAMPAIGN_DURATION);
        assertEq(booster.campaignType(), DEFAULT_CAMPAIGN_TYPE);
        assertEq(booster.rewardToken(), address(oeth));
        assertEq(booster.merklDistributor(), mockMerklDistributor);
        assertEq(booster.campaignData(), DEFAULT_CAMPAIGN_DATA);
        assertEq(booster.governor(), governor);
        assertEq(booster.strategistAddr(), strategist);
        assertEq(booster.factory(), address(factoryMerkl));
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

    function test_createPoolBooster_RevertWhen_poolAlreadyExists() public {
        vm.startPrank(governor);
        factoryMerkl.createPoolBoosterMerkl(mockAmmPool, _defaultInitData(), 1);

        vm.expectRevert("Pool booster already exists");
        factoryMerkl.createPoolBoosterMerkl(mockAmmPool, _defaultInitData(), 2);
        vm.stopPrank();
    }
}
