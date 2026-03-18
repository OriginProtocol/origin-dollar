// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {
    Smoke_PoolBoosterMerklMainnet_Shared_Test
} from "tests/smoke/poolBooster/PoolBoosterMerklMainnet/shared/Shared.t.sol";

contract Smoke_Concrete_PoolBoosterMerklMainnet_Test is Smoke_PoolBoosterMerklMainnet_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_merklDistributor() public view {
        assertEq(address(boosterMerkl.merklDistributor()), Mainnet.CampaignCreator);
    }

    function test_rewardToken() public view {
        assertEq(address(boosterMerkl.rewardToken()), Mainnet.OETHProxy);
    }

    function test_duration() public view {
        assertGt(boosterMerkl.duration(), 1 hours);
    }

    function test_campaignType() public view {
        boosterMerkl.campaignType();
    }

    function test_creator() public view {
        assertNotEq(boosterMerkl.creator(), address(0));
    }

    function test_campaignData() public view {
        bytes memory data = boosterMerkl.campaignData();
        assertGt(data.length, 0);
    }

    function test_minBribeAmount() public view {
        assertEq(boosterMerkl.MIN_BRIBE_AMOUNT(), 1e10);
    }

    function test_getNextPeriodStartTime() public view {
        assertGt(boosterMerkl.getNextPeriodStartTime(), block.timestamp);
    }

    function test_isValidSignature() public {
        vm.prank(Mainnet.CampaignCreator);
        bytes4 magicValue = boosterMerkl.isValidSignature(bytes32(0), "");
        assertEq(magicValue, bytes4(0x1626ba7e));
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////

    function test_bribe() public {
        _fundBooster(address(boosterMerkl), 10 ether);
        assertGt(IERC20(Mainnet.OETHProxy).balanceOf(address(boosterMerkl)), 0);

        boosterMerkl.bribe();

        assertEq(IERC20(Mainnet.OETHProxy).balanceOf(address(boosterMerkl)), 0);
    }
}
