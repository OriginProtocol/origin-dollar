// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.sol";
import {PoolBoosterMerkl} from "contracts/poolBooster/PoolBoosterMerkl.sol";

contract Unit_Concrete_PoolBoosterMerkl_Constructor_Test is Unit_Merkl_Shared_Test {
    function test_constructor() public view {
        assertEq(address(boosterMerkl.merklDistributor()), mockMerklDistributor);
        assertEq(address(boosterMerkl.rewardToken()), address(oeth));
        assertEq(boosterMerkl.duration(), DEFAULT_CAMPAIGN_DURATION);
        assertEq(boosterMerkl.campaignType(), DEFAULT_CAMPAIGN_TYPE);
        assertEq(boosterMerkl.creator(), governor);
        assertEq(boosterMerkl.campaignData(), DEFAULT_CAMPAIGN_DATA);
        assertEq(boosterMerkl.MIN_BRIBE_AMOUNT(), 1e10);
    }

    function test_constructor_RevertWhen_zeroRewardToken() public {
        vm.expectRevert("Invalid rewardToken address");
        new PoolBoosterMerkl(
            address(0),
            mockMerklDistributor,
            DEFAULT_CAMPAIGN_DURATION,
            DEFAULT_CAMPAIGN_TYPE,
            governor,
            DEFAULT_CAMPAIGN_DATA
        );
    }

    function test_constructor_RevertWhen_zeroDistributor() public {
        vm.expectRevert("Invalid merklDistributor address");
        new PoolBoosterMerkl(
            address(oeth),
            address(0),
            DEFAULT_CAMPAIGN_DURATION,
            DEFAULT_CAMPAIGN_TYPE,
            governor,
            DEFAULT_CAMPAIGN_DATA
        );
    }

    function test_constructor_RevertWhen_emptyData() public {
        vm.expectRevert("Invalid campaignData");
        new PoolBoosterMerkl(
            address(oeth),
            mockMerklDistributor,
            DEFAULT_CAMPAIGN_DURATION,
            DEFAULT_CAMPAIGN_TYPE,
            governor,
            hex""
        );
    }

    function test_constructor_RevertWhen_durationTooShort() public {
        vm.expectRevert("Invalid duration");
        new PoolBoosterMerkl(
            address(oeth),
            mockMerklDistributor,
            3600, // exactly 1 hour, must be > 1 hours
            DEFAULT_CAMPAIGN_TYPE,
            governor,
            DEFAULT_CAMPAIGN_DATA
        );
    }

    function test_constructor_durationBoundary() public {
        PoolBoosterMerkl booster = new PoolBoosterMerkl(
            address(oeth),
            mockMerklDistributor,
            3601,
            DEFAULT_CAMPAIGN_TYPE,
            governor,
            DEFAULT_CAMPAIGN_DATA
        );
        assertEq(booster.duration(), 3601);
    }
}
