// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Smoke_PoolBoosterMerklBase_Shared_Test
} from "tests/smoke/base/poolBooster/PoolBoosterMerklBase/shared/Shared.t.sol";

// --- Test utilities
import {Base} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Smoke_Concrete_PoolBoosterMerklBase_Test is Smoke_PoolBoosterMerklBase_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_merklDistributor() public view {
        assertEq(address(boosterMerkl.merklDistributor()), Base.MerklDistributor);
    }

    function test_rewardToken() public view {
        (bool success, bytes memory data) = address(boosterMerkl).staticcall(abi.encodeWithSignature("rewardToken()"));
        assertTrue(success);
        address token = abi.decode(data, (address));
        assertEq(token, Base.OETHBaseProxy);
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
        _mintAndFundBooster(address(boosterMerkl), 1 ether);
        assertGt(IERC20(Base.OETHBaseProxy).balanceOf(address(boosterMerkl)), 0);

        // V1: anyone can call. V2: needs governor. Try governor first, fallback to direct.
        (bool hasGovernor, bytes memory govData) =
            address(boosterMerkl).staticcall(abi.encodeWithSignature("governor()"));
        if (hasGovernor && govData.length >= 32) {
            vm.prank(abi.decode(govData, (address)));
        }
        (bool success,) = address(boosterMerkl).call(abi.encodeWithSignature("bribe()"));
        assertTrue(success, "bribe() failed");

        assertEq(IERC20(Base.OETHBaseProxy).balanceOf(address(boosterMerkl)), 0);
    }
}
