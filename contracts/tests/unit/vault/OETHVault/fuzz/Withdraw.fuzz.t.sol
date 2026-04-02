// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OETHVault_Shared_Test} from "tests/unit/vault/OETHVault/shared/Shared.t.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";

contract Unit_Fuzz_OETHVault_Withdraw_Test is Unit_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- WITHDRAW FUZZ TESTS
    //////////////////////////////////////////////////////

    /// @notice requestWithdrawal burns OETH: user balance and totalSupply both decrease
    function testFuzz_requestWithdrawal_burnsOETH(uint256 amount) public {
        amount = bound(amount, 1, 100e18);

        _mintOETH(alice, amount);

        uint256 supplyBefore = oeth.totalSupply();
        uint256 balBefore = oeth.balanceOf(alice);

        vm.prank(alice);
        oethVault.requestWithdrawal(amount);

        assertEq(oeth.balanceOf(alice), balBefore - amount);
        assertEq(oeth.totalSupply(), supplyBefore - amount);
    }

    /// @notice queue metadata: claimed <= claimable <= queued, and queued increases by amount
    function testFuzz_requestWithdrawal_queueMetadata(uint256 amount) public {
        amount = bound(amount, 1, 100e18);

        _mintOETH(alice, amount);

        uint128 queuedBefore = oethVault.withdrawalQueueMetadata().queued;

        vm.prank(alice);
        oethVault.requestWithdrawal(amount);

        uint128 queued = oethVault.withdrawalQueueMetadata().queued;
        uint128 claimable = oethVault.withdrawalQueueMetadata().claimable;
        uint128 claimed = oethVault.withdrawalQueueMetadata().claimed;

        // No scaling — WETH and OETH both 18 decimals
        assertEq(queued, queuedBefore + uint128(amount));
        assertLe(claimed, claimable);
        assertLe(claimable, queued);
    }

    /// @notice user receives exact amount of WETH after claim (no dust loss)
    function testFuzz_claimWithdrawal_wethReceived(uint256 amount) public {
        amount = bound(amount, 1, 100e18);

        _mintOETH(alice, amount);

        vm.prank(alice);
        (uint256 requestId,) = oethVault.requestWithdrawal(amount);

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint256 wethBefore = weth.balanceOf(alice);
        vm.prank(alice);
        oethVault.claimWithdrawal(requestId);

        // No scaling — receives exact amount
        assertEq(weth.balanceOf(alice) - wethBefore, amount);
    }

    /// @notice claimed increases by amount after claim
    function testFuzz_claimWithdrawal_claimedIncreases(uint256 amount) public {
        amount = bound(amount, 1, 100e18);

        _mintOETH(alice, amount);

        vm.prank(alice);
        (uint256 requestId,) = oethVault.requestWithdrawal(amount);

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint128 claimedBefore = oethVault.withdrawalQueueMetadata().claimed;

        vm.prank(alice);
        oethVault.claimWithdrawal(requestId);

        uint128 claimedAfter = oethVault.withdrawalQueueMetadata().claimed;
        // No scaling — claimed increases by exact amount
        assertEq(claimedAfter, claimedBefore + uint128(amount));
    }

    /// @notice two users request and claim: each gets correct WETH, queue is consistent
    function testFuzz_requestThenClaim_twoUsers(uint256 a1, uint256 a2) public {
        a1 = bound(a1, 1, 100e18);
        a2 = bound(a2, 1, 100e18);

        _mintOETH(alice, a1);
        _mintOETH(bobby, a2);

        vm.prank(alice);
        (uint256 id1,) = oethVault.requestWithdrawal(a1);

        vm.prank(bobby);
        (uint256 id2,) = oethVault.requestWithdrawal(a2);

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint256 aliceWethBefore = weth.balanceOf(alice);
        vm.prank(alice);
        oethVault.claimWithdrawal(id1);
        assertEq(weth.balanceOf(alice) - aliceWethBefore, a1);

        uint256 bobbyWethBefore = weth.balanceOf(bobby);
        vm.prank(bobby);
        oethVault.claimWithdrawal(id2);
        assertEq(weth.balanceOf(bobby) - bobbyWethBefore, a2);

        // Queue consistency: claimed <= claimable <= queued
        uint128 queued = oethVault.withdrawalQueueMetadata().queued;
        uint128 claimable = oethVault.withdrawalQueueMetadata().claimable;
        uint128 claimed = oethVault.withdrawalQueueMetadata().claimed;
        assertLe(claimed, claimable);
        assertLe(claimable, queued);
    }

    /// @notice allocate respects vault buffer: strategy gets max(0, available - supply * buffer / 1e18)
    function testFuzz_allocate_respectsVaultBuffer(uint256 mintAmt, uint256 buffer) public {
        mintAmt = bound(mintAmt, 1e18, 1e22);
        buffer = bound(buffer, 0, 1e18);

        // Deploy and configure strategy
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        oethVault.setDefaultStrategy(address(strategy));
        oethVault.setVaultBuffer(buffer);
        vm.stopPrank();

        _mintOETH(alice, mintAmt);

        // Allocate
        vm.prank(governor);
        oethVault.allocate();

        uint256 totalSupply = oeth.totalSupply();
        // Target buffer in WETH = totalSupply * buffer / 1e18 (no extra scaling since WETH is 18 dec)
        uint256 targetBufferWeth = (totalSupply * buffer) / 1e18;

        // Vault WETH after allocate
        uint256 vaultWeth = weth.balanceOf(address(oethVault));

        // Vault should hold at least targetBuffer (± 1 WETH for rounding)
        if (buffer > 0) {
            assertApproxEqAbs(vaultWeth, targetBufferWeth, 1e18); // 1 WETH tolerance
        }

        // Strategy balance should be the remainder
        uint256 strategyBal = weth.balanceOf(address(strategy));
        // Total WETH in system should equal all minted WETH (200e18 from setUp + mintAmt)
        assertEq(vaultWeth + strategyBal, 200e18 + mintAmt);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _toArray(address a) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }

    function _toArray(uint256 a) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](1);
        arr[0] = a;
    }
}
