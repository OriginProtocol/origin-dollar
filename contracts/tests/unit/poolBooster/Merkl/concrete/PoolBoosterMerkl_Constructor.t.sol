// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.t.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {IMerklDistributor} from "contracts/interfaces/poolBooster/IMerklDistributor.sol";
import {IPoolBoosterMerkl} from "contracts/interfaces/poolBooster/IPoolBoosterMerkl.sol";

contract Unit_Concrete_PoolBoosterMerkl_Constructor_Test is Unit_Merkl_Shared_Test {
    function test_initialize() public view {
        assertEq(address(boosterMerkl.merklDistributor()), mockMerklDistributor);
        assertEq(boosterMerkl.rewardToken(), address(oeth));
        assertEq(boosterMerkl.duration(), DEFAULT_CAMPAIGN_DURATION);
        assertEq(boosterMerkl.campaignType(), DEFAULT_CAMPAIGN_TYPE);
        assertEq(boosterMerkl.campaignData(), DEFAULT_CAMPAIGN_DATA);
        assertEq(boosterMerkl.MIN_BRIBE_AMOUNT(), 1e10);
    }

    function test_initialize_RevertWhen_zeroRewardToken() public {
        bytes memory initData = abi.encodeWithSelector(
            IPoolBoosterMerkl.initialize.selector,
            DEFAULT_CAMPAIGN_DURATION,
            DEFAULT_CAMPAIGN_TYPE,
            address(0),
            mockMerklDistributor,
            governor,
            strategist,
            DEFAULT_CAMPAIGN_DATA
        );

        vm.expectRevert("Invalid rewardToken address");
        new BeaconProxy(address(beacon), initData);
    }

    function test_initialize_RevertWhen_zeroDistributor() public {
        bytes memory initData = abi.encodeWithSelector(
            IPoolBoosterMerkl.initialize.selector,
            DEFAULT_CAMPAIGN_DURATION,
            DEFAULT_CAMPAIGN_TYPE,
            address(oeth),
            address(0),
            governor,
            strategist,
            DEFAULT_CAMPAIGN_DATA
        );

        vm.expectRevert("Invalid merklDistributor addr");
        new BeaconProxy(address(beacon), initData);
    }

    function test_initialize_RevertWhen_emptyData() public {
        bytes memory initData = abi.encodeWithSelector(
            IPoolBoosterMerkl.initialize.selector,
            DEFAULT_CAMPAIGN_DURATION,
            DEFAULT_CAMPAIGN_TYPE,
            address(oeth),
            mockMerklDistributor,
            governor,
            strategist,
            hex""
        );

        vm.expectRevert("Invalid campaign data");
        new BeaconProxy(address(beacon), initData);
    }

    function test_initialize_RevertWhen_durationTooShort() public {
        bytes memory initData = abi.encodeWithSelector(
            IPoolBoosterMerkl.initialize.selector,
            3600, // exactly 1 hour, must be > 1 hours
            DEFAULT_CAMPAIGN_TYPE,
            address(oeth),
            mockMerklDistributor,
            governor,
            strategist,
            DEFAULT_CAMPAIGN_DATA
        );

        vm.expectRevert("Invalid duration");
        new BeaconProxy(address(beacon), initData);
    }

    function test_initialize_durationBoundary() public {
        bytes memory initData = abi.encodeWithSelector(
            IPoolBoosterMerkl.initialize.selector,
            3601,
            DEFAULT_CAMPAIGN_TYPE,
            address(oeth),
            mockMerklDistributor,
            governor,
            strategist,
            DEFAULT_CAMPAIGN_DATA
        );

        IPoolBoosterMerkl booster = IPoolBoosterMerkl(address(new BeaconProxy(address(beacon), initData)));
        assertEq(booster.duration(), 3601);
    }
}
