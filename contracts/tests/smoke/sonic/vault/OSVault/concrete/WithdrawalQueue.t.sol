// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OSVault_Shared_Test} from "tests/smoke/sonic/vault/OSVault/shared/Shared.t.sol";

contract Smoke_Concrete_OSVault_WithdrawalQueue_Test is Smoke_OSVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- WITHDRAWAL_QUEUE
    //////////////////////////////////////////////////////

    function test_requestWithdrawal_updatesQueueMetadata() public {
        _mintOSonic(alice, 1000 ether);
        uint256 oSonicBalance = oSonic.balanceOf(alice);

        uint256 queuedBefore = oSonicVault.withdrawalQueueMetadata().queued;
        uint256 nextIndexBefore = oSonicVault.withdrawalQueueMetadata().nextWithdrawalIndex;

        vm.prank(alice);
        oSonicVault.requestWithdrawal(oSonicBalance);

        uint256 queuedAfter = oSonicVault.withdrawalQueueMetadata().queued;
        uint256 nextIndexAfter = oSonicVault.withdrawalQueueMetadata().nextWithdrawalIndex;

        assertGt(queuedAfter, queuedBefore);
        assertEq(nextIndexAfter, nextIndexBefore + 1);
    }

    function test_claimWithdrawals_multipleRequests() public {
        _mintOSonic(alice, 1000 ether);
        _mintOSonic(bobby, 2000 ether);
        _mintOSonic(cathy, 500 ether);

        uint256 aliceOS = oSonic.balanceOf(alice);
        uint256 bobbyOS = oSonic.balanceOf(bobby);
        uint256 cathyOS = oSonic.balanceOf(cathy);

        vm.prank(alice);
        (uint256 id0,) = oSonicVault.requestWithdrawal(aliceOS);
        vm.prank(bobby);
        (uint256 id1,) = oSonicVault.requestWithdrawal(bobbyOS);
        vm.prank(cathy);
        (uint256 id2,) = oSonicVault.requestWithdrawal(cathyOS);

        _ensureVaultLiquidity(3500 ether);
        vm.warp(block.timestamp + oSonicVault.withdrawalClaimDelay());

        uint256 wsBefore = wrappedSonic.balanceOf(alice);
        uint256[] memory aliceIds = new uint256[](1);
        aliceIds[0] = id0;
        vm.prank(alice);
        oSonicVault.claimWithdrawals(aliceIds);
        assertGt(wrappedSonic.balanceOf(alice) - wsBefore, 0);

        wsBefore = wrappedSonic.balanceOf(bobby);
        vm.prank(bobby);
        oSonicVault.claimWithdrawal(id1);
        assertGt(wrappedSonic.balanceOf(bobby) - wsBefore, 0);

        wsBefore = wrappedSonic.balanceOf(cathy);
        vm.prank(cathy);
        oSonicVault.claimWithdrawal(id2);
        assertGt(wrappedSonic.balanceOf(cathy) - wsBefore, 0);
    }

    function test_addWithdrawalQueueLiquidity_updatesClaimable() public {
        _mintOSonic(alice, 1000 ether);
        uint256 oSonicBalance = oSonic.balanceOf(alice);

        vm.prank(alice);
        oSonicVault.requestWithdrawal(oSonicBalance);

        uint256 queued = oSonicVault.withdrawalQueueMetadata().queued;
        uint256 claimableBefore = oSonicVault.withdrawalQueueMetadata().claimable;

        if (queued > claimableBefore) {
            deal(address(wrappedSonic), address(oSonicVault), wrappedSonic.balanceOf(address(oSonicVault)) + 1000 ether);
            oSonicVault.addWithdrawalQueueLiquidity();

            uint256 claimableAfter = oSonicVault.withdrawalQueueMetadata().claimable;
            assertGt(claimableAfter, claimableBefore);
        }
    }

    function test_withdrawalRequest_storedCorrectly() public {
        _mintOSonic(alice, 1000 ether);
        uint256 oSonicBalance = oSonic.balanceOf(alice);

        vm.prank(alice);
        (uint256 requestId,) = oSonicVault.requestWithdrawal(oSonicBalance);

        address withdrawer = oSonicVault.withdrawalRequests(requestId).withdrawer;
        bool claimed = oSonicVault.withdrawalRequests(requestId).claimed;
        uint40 timestamp = oSonicVault.withdrawalRequests(requestId).timestamp;

        assertEq(withdrawer, alice);
        assertFalse(claimed);
        assertEq(timestamp, uint40(block.timestamp));
    }
}
