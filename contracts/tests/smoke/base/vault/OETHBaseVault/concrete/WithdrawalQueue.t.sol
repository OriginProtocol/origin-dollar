// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHBaseVault_Shared_Test} from "tests/smoke/base/vault/OETHBaseVault/shared/Shared.t.sol";

contract Smoke_Concrete_OETHBaseVault_WithdrawalQueue_Test is Smoke_OETHBaseVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- WITHDRAWAL_QUEUE
    //////////////////////////////////////////////////////

    function test_requestWithdrawal_updatesQueueMetadata() public {
        _mintOETHBase(alice, 1 ether);
        uint256 oethbBalance = oethBase.balanceOf(alice);

        (uint256 queuedBefore,,, uint256 nextIndexBefore) = oethBaseVault.withdrawalQueueMetadata();

        vm.prank(alice);
        oethBaseVault.requestWithdrawal(oethbBalance);

        (uint256 queuedAfter,,, uint256 nextIndexAfter) = oethBaseVault.withdrawalQueueMetadata();

        assertGt(queuedAfter, queuedBefore);
        assertEq(nextIndexAfter, nextIndexBefore + 1);
    }

    function test_claimWithdrawals_multipleRequests() public {
        _mintOETHBase(alice, 1 ether);
        _mintOETHBase(bobby, 2 ether);
        _mintOETHBase(cathy, 0.5 ether);

        uint256 aliceOethb = oethBase.balanceOf(alice);
        uint256 bobbyOethb = oethBase.balanceOf(bobby);
        uint256 cathyOethb = oethBase.balanceOf(cathy);

        vm.prank(alice);
        (uint256 id0,) = oethBaseVault.requestWithdrawal(aliceOethb);
        vm.prank(bobby);
        (uint256 id1,) = oethBaseVault.requestWithdrawal(bobbyOethb);
        vm.prank(cathy);
        (uint256 id2,) = oethBaseVault.requestWithdrawal(cathyOethb);

        _ensureVaultLiquidity(3.5 ether);
        vm.warp(block.timestamp + oethBaseVault.withdrawalClaimDelay());

        uint256 wethBefore = weth.balanceOf(alice);
        uint256[] memory aliceIds = new uint256[](1);
        aliceIds[0] = id0;
        vm.prank(alice);
        oethBaseVault.claimWithdrawals(aliceIds);
        assertGt(weth.balanceOf(alice) - wethBefore, 0);

        wethBefore = weth.balanceOf(bobby);
        vm.prank(bobby);
        oethBaseVault.claimWithdrawal(id1);
        assertGt(weth.balanceOf(bobby) - wethBefore, 0);

        wethBefore = weth.balanceOf(cathy);
        vm.prank(cathy);
        oethBaseVault.claimWithdrawal(id2);
        assertGt(weth.balanceOf(cathy) - wethBefore, 0);
    }

    function test_addWithdrawalQueueLiquidity_updatesClaimable() public {
        _mintOETHBase(alice, 1 ether);
        uint256 oethbBalance = oethBase.balanceOf(alice);

        vm.prank(alice);
        oethBaseVault.requestWithdrawal(oethbBalance);

        (uint256 queued, uint256 claimableBefore,,) = oethBaseVault.withdrawalQueueMetadata();

        if (queued > claimableBefore) {
            deal(address(weth), address(oethBaseVault), weth.balanceOf(address(oethBaseVault)) + 1 ether);
            oethBaseVault.addWithdrawalQueueLiquidity();

            (, uint256 claimableAfter,,) = oethBaseVault.withdrawalQueueMetadata();
            assertGt(claimableAfter, claimableBefore);
        }
    }

    function test_withdrawalRequest_storedCorrectly() public {
        _mintOETHBase(alice, 1 ether);
        uint256 oethbBalance = oethBase.balanceOf(alice);

        vm.prank(alice);
        (uint256 requestId,) = oethBaseVault.requestWithdrawal(oethbBalance);

        (address withdrawer, bool claimed, uint40 timestamp,,) = oethBaseVault.withdrawalRequests(requestId);

        assertEq(withdrawer, alice);
        assertFalse(claimed);
        assertEq(timestamp, uint40(block.timestamp));
    }
}
