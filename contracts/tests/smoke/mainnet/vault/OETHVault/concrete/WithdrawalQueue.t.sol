// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHVault_Shared_Test} from "tests/smoke/mainnet/vault/OETHVault/shared/Shared.t.sol";

contract Smoke_Concrete_OETHVault_WithdrawalQueue_Test is Smoke_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- WITHDRAWAL_QUEUE
    //////////////////////////////////////////////////////

    function test_requestWithdrawal_updatesQueueMetadata() public {
        _mintOETH(alice, 1 ether);
        uint256 oethBalance = oeth.balanceOf(alice);

        (uint256 queuedBefore,,, uint256 nextIndexBefore) = oethVault.withdrawalQueueMetadata();

        vm.prank(alice);
        oethVault.requestWithdrawal(oethBalance);

        (uint256 queuedAfter,,, uint256 nextIndexAfter) = oethVault.withdrawalQueueMetadata();

        assertGt(queuedAfter, queuedBefore);
        assertEq(nextIndexAfter, nextIndexBefore + 1);
    }

    function test_claimWithdrawals_multipleRequests() public {
        _mintOETH(alice, 1 ether);
        _mintOETH(bobby, 2 ether);
        _mintOETH(cathy, 0.5 ether);

        uint256 aliceOeth = oeth.balanceOf(alice);
        uint256 bobbyOeth = oeth.balanceOf(bobby);
        uint256 cathyOeth = oeth.balanceOf(cathy);

        vm.prank(alice);
        (uint256 id0,) = oethVault.requestWithdrawal(aliceOeth);
        vm.prank(bobby);
        (uint256 id1,) = oethVault.requestWithdrawal(bobbyOeth);
        vm.prank(cathy);
        (uint256 id2,) = oethVault.requestWithdrawal(cathyOeth);

        _ensureVaultLiquidity(3.5 ether);
        vm.warp(block.timestamp + oethVault.withdrawalClaimDelay());

        uint256 wethBefore = weth.balanceOf(alice);
        uint256[] memory aliceIds = new uint256[](1);
        aliceIds[0] = id0;
        vm.prank(alice);
        oethVault.claimWithdrawals(aliceIds);
        assertGt(weth.balanceOf(alice) - wethBefore, 0);

        wethBefore = weth.balanceOf(bobby);
        vm.prank(bobby);
        oethVault.claimWithdrawal(id1);
        assertGt(weth.balanceOf(bobby) - wethBefore, 0);

        wethBefore = weth.balanceOf(cathy);
        vm.prank(cathy);
        oethVault.claimWithdrawal(id2);
        assertGt(weth.balanceOf(cathy) - wethBefore, 0);
    }

    function test_addWithdrawalQueueLiquidity_updatesClaimable() public {
        _mintOETH(alice, 1 ether);
        uint256 oethBalance = oeth.balanceOf(alice);

        vm.prank(alice);
        oethVault.requestWithdrawal(oethBalance);

        (uint256 queued, uint256 claimableBefore,,) = oethVault.withdrawalQueueMetadata();

        if (queued > claimableBefore) {
            deal(address(weth), address(oethVault), weth.balanceOf(address(oethVault)) + 1 ether);
            oethVault.addWithdrawalQueueLiquidity();

            (, uint256 claimableAfter,,) = oethVault.withdrawalQueueMetadata();
            assertGt(claimableAfter, claimableBefore);
        }
    }

    function test_withdrawalRequest_storedCorrectly() public {
        _mintOETH(alice, 1 ether);
        uint256 oethBalance = oeth.balanceOf(alice);

        vm.prank(alice);
        (uint256 requestId,) = oethVault.requestWithdrawal(oethBalance);

        (address withdrawer, bool claimed, uint40 timestamp,,) = oethVault.withdrawalRequests(requestId);

        assertEq(withdrawer, alice);
        assertFalse(claimed);
        assertEq(timestamp, uint40(block.timestamp));
    }
}
