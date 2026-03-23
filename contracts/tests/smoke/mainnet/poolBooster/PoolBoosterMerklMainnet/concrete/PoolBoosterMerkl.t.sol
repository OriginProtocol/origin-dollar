// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {
    Smoke_PoolBoosterMerklMainnet_Shared_Test
} from "tests/smoke/mainnet/poolBooster/PoolBoosterMerklMainnet/shared/Shared.t.sol";

contract Smoke_Concrete_PoolBoosterMerklMainnet_Test is Smoke_PoolBoosterMerklMainnet_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_merklDistributor() public view {
        assertEq(address(boosterMerkl.merklDistributor()), Mainnet.CampaignCreator);
    }

    function test_rewardToken() public view {
        // V1: rewardToken() returns IERC20, V2: returns address — both work via ABI
        (bool success, bytes memory data) = address(boosterMerkl).staticcall(abi.encodeWithSignature("rewardToken()"));
        assertTrue(success);
        address token = abi.decode(data, (address));
        assertEq(token, Mainnet.OETHProxy);
    }

    function test_duration() public view {
        assertGt(boosterMerkl.duration(), 1 hours);
    }

    function test_campaignType() public view {
        boosterMerkl.campaignType();
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

    //////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////

    function test_bribe() public {
        _fundBooster(address(boosterMerkl), 10 ether);
        assertGt(IERC20(Mainnet.OETHProxy).balanceOf(address(boosterMerkl)), 0);

        // V1: anyone can call bribe(), V2: needs governor/strategist
        // Try as governor first, fall back to direct call
        (bool success,) = address(boosterMerkl).staticcall(abi.encodeWithSignature("governor()"));
        if (success) {
            (, bytes memory govData) = address(boosterMerkl).staticcall(abi.encodeWithSignature("governor()"));
            address gov = abi.decode(govData, (address));
            vm.prank(gov);
        }
        boosterMerkl.bribe();

        assertEq(IERC20(Mainnet.OETHProxy).balanceOf(address(boosterMerkl)), 0);
    }
}
