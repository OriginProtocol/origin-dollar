// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OUSDVault_Shared_Test} from "tests/smoke/mainnet/vault/OUSDVault/shared/Shared.t.sol";

contract Smoke_Concrete_OUSDVault_WithdrawalQueue_Test is Smoke_OUSDVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- WITHDRAWAL_QUEUE
    //////////////////////////////////////////////////////

    function test_requestWithdrawal_updatesQueueMetadata() public {
        _mintOUSD(alice, 1000e6);
        uint256 ousdBalance = ousd.balanceOf(alice);

        (uint256 queuedBefore,,, uint256 nextIndexBefore) = ousdVault.withdrawalQueueMetadata();

        vm.prank(alice);
        ousdVault.requestWithdrawal(ousdBalance);

        (uint256 queuedAfter,,, uint256 nextIndexAfter) = ousdVault.withdrawalQueueMetadata();

        assertGt(queuedAfter, queuedBefore);
        assertEq(nextIndexAfter, nextIndexBefore + 1);
    }

    function test_claimWithdrawals_multipleRequests() public {
        // Mint for 3 users
        _mintOUSD(alice, 1000e6);
        _mintOUSD(bobby, 2000e6);
        _mintOUSD(cathy, 500e6);

        uint256 aliceOusd = ousd.balanceOf(alice);
        uint256 bobbyOusd = ousd.balanceOf(bobby);
        uint256 cathyOusd = ousd.balanceOf(cathy);

        // Request withdrawals
        vm.prank(alice);
        (uint256 id0,) = ousdVault.requestWithdrawal(aliceOusd);
        vm.prank(bobby);
        (uint256 id1,) = ousdVault.requestWithdrawal(bobbyOusd);
        vm.prank(cathy);
        (uint256 id2,) = ousdVault.requestWithdrawal(cathyOusd);

        // Ensure vault liquidity and warp past delay
        _ensureVaultLiquidity(3500e6);
        vm.warp(block.timestamp + ousdVault.withdrawalClaimDelay());

        // Claim all for alice
        uint256 usdcBefore = usdc.balanceOf(alice);
        uint256[] memory aliceIds = new uint256[](1);
        aliceIds[0] = id0;
        vm.prank(alice);
        ousdVault.claimWithdrawals(aliceIds);
        assertGt(usdc.balanceOf(alice) - usdcBefore, 0);

        // Claim for bobby
        usdcBefore = usdc.balanceOf(bobby);
        vm.prank(bobby);
        ousdVault.claimWithdrawal(id1);
        assertGt(usdc.balanceOf(bobby) - usdcBefore, 0);

        // Claim for cathy
        usdcBefore = usdc.balanceOf(cathy);
        vm.prank(cathy);
        ousdVault.claimWithdrawal(id2);
        assertGt(usdc.balanceOf(cathy) - usdcBefore, 0);
    }

    function test_addWithdrawalQueueLiquidity_updatesClaimable() public {
        _mintOUSD(alice, 1000e6);
        uint256 ousdBalance = ousd.balanceOf(alice);

        vm.prank(alice);
        ousdVault.requestWithdrawal(ousdBalance);

        (uint256 queued, uint256 claimableBefore,,) = ousdVault.withdrawalQueueMetadata();

        // If there's already a shortfall, deal USDC to vault and add liquidity
        if (queued > claimableBefore) {
            deal(address(usdc), address(ousdVault), usdc.balanceOf(address(ousdVault)) + 1000e6);
            ousdVault.addWithdrawalQueueLiquidity();

            (, uint256 claimableAfter,,) = ousdVault.withdrawalQueueMetadata();
            assertGt(claimableAfter, claimableBefore);
        }
    }

    function test_withdrawalRequest_storedCorrectly() public {
        _mintOUSD(alice, 1000e6);
        uint256 ousdBalance = ousd.balanceOf(alice);

        vm.prank(alice);
        (uint256 requestId,) = ousdVault.requestWithdrawal(ousdBalance);

        (address withdrawer, bool claimed, uint40 timestamp,,) = ousdVault.withdrawalRequests(requestId);

        assertEq(withdrawer, alice);
        assertFalse(claimed);
        assertEq(timestamp, uint40(block.timestamp));
    }
}
