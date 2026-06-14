// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Shared_Test} from "tests/unit/vault/OUSDVault/shared/Shared.t.sol";

// --- Project imports
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";

contract Unit_Fuzz_OUSDVault_Withdraw_Test is Unit_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- WITHDRAW FUZZ TESTS
    //////////////////////////////////////////////////////

    /// @notice requestWithdrawal burns OUSD: user balance and totalSupply both decrease
    function testFuzz_requestWithdrawal_burnsOUSD(uint256 amount) public {
        amount = bound(amount, 1, 100e18);

        // Mint enough for alice
        uint256 usdcNeeded = (amount / 1e12) + 1;
        _mintOUSD(alice, usdcNeeded);

        // Ensure alice has at least `amount` OUSD
        uint256 aliceBal = ousd.balanceOf(alice);
        require(aliceBal >= amount, "insufficient OUSD");

        uint256 supplyBefore = ousd.totalSupply();
        uint256 balBefore = ousd.balanceOf(alice);

        vm.prank(alice);
        ousdVault.requestWithdrawal(amount);

        assertEq(ousd.balanceOf(alice), balBefore - amount);
        assertEq(ousd.totalSupply(), supplyBefore - amount);
    }

    /// @notice queue metadata: claimed <= claimable <= queued, and queued increases by amount / 1e12
    function testFuzz_requestWithdrawal_queueMetadata(uint256 amount) public {
        amount = bound(amount, 1e12, 100e18);

        uint256 usdcNeeded = (amount / 1e12) + 1;
        _mintOUSD(alice, usdcNeeded);

        uint128 queuedBefore = ousdVault.withdrawalQueueMetadata().queued;

        vm.prank(alice);
        ousdVault.requestWithdrawal(amount);

        uint128 queued = ousdVault.withdrawalQueueMetadata().queued;
        uint128 claimable = ousdVault.withdrawalQueueMetadata().claimable;
        uint128 claimed = ousdVault.withdrawalQueueMetadata().claimed;

        assertEq(queued, queuedBefore + uint128(amount / 1e12));
        assertLe(claimed, claimable);
        assertLe(claimable, queued);
    }

    /// @notice user receives amount / 1e12 USDC after claim
    function testFuzz_claimWithdrawal_usdcReceived(uint256 amount) public {
        amount = bound(amount, 1e12, 100e18);

        uint256 usdcNeeded = (amount / 1e12) + 1;
        _mintOUSD(alice, usdcNeeded);

        vm.prank(alice);
        (uint256 requestId,) = ousdVault.requestWithdrawal(amount);

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint256 usdcBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        ousdVault.claimWithdrawal(requestId);

        assertEq(usdc.balanceOf(alice) - usdcBefore, amount / 1e12);
    }

    /// @notice claimed increases by amount / 1e12 after claim
    function testFuzz_claimWithdrawal_claimedIncreases(uint256 amount) public {
        amount = bound(amount, 1e12, 100e18);

        uint256 usdcNeeded = (amount / 1e12) + 1;
        _mintOUSD(alice, usdcNeeded);

        vm.prank(alice);
        (uint256 requestId,) = ousdVault.requestWithdrawal(amount);

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint128 claimedBefore = ousdVault.withdrawalQueueMetadata().claimed;

        vm.prank(alice);
        ousdVault.claimWithdrawal(requestId);

        uint128 claimedAfter = ousdVault.withdrawalQueueMetadata().claimed;
        assertEq(claimedAfter, claimedBefore + uint128(amount / 1e12));
    }

    /// @notice two users request and claim: each gets correct USDC, queue is consistent
    function testFuzz_requestThenClaim_twoUsers(uint256 a1, uint256 a2) public {
        a1 = bound(a1, 1e12, 100e18);
        a2 = bound(a2, 1e12, 100e18);

        uint256 usdc1 = (a1 / 1e12) + 1;
        uint256 usdc2 = (a2 / 1e12) + 1;
        _mintOUSD(alice, usdc1);
        _mintOUSD(bobby, usdc2);

        vm.prank(alice);
        (uint256 id1,) = ousdVault.requestWithdrawal(a1);

        vm.prank(bobby);
        (uint256 id2,) = ousdVault.requestWithdrawal(a2);

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint256 aliceUsdcBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        ousdVault.claimWithdrawal(id1);
        assertEq(usdc.balanceOf(alice) - aliceUsdcBefore, a1 / 1e12);

        uint256 bobbyUsdcBefore = usdc.balanceOf(bobby);
        vm.prank(bobby);
        ousdVault.claimWithdrawal(id2);
        assertEq(usdc.balanceOf(bobby) - bobbyUsdcBefore, a2 / 1e12);

        // Queue consistency: claimed <= claimable <= queued
        uint128 queued = ousdVault.withdrawalQueueMetadata().queued;
        uint128 claimable = ousdVault.withdrawalQueueMetadata().claimable;
        uint128 claimed = ousdVault.withdrawalQueueMetadata().claimed;
        assertLe(claimed, claimable);
        assertLe(claimable, queued);
    }

    /// @notice withdraw dust: USDC received = amount / 1e12, dust is burned
    function testFuzz_withdraw_dustLoss(uint256 amount) public {
        amount = bound(amount, 1, 100e18);

        uint256 usdcNeeded = (amount / 1e12) + 1;
        if (usdcNeeded == 0) usdcNeeded = 1;
        _mintOUSD(alice, usdcNeeded);

        uint256 aliceOusd = ousd.balanceOf(alice);
        if (aliceOusd < amount) return; // Skip if can't cover

        uint256 supplyBefore = ousd.totalSupply();
        uint256 expectedUsdc = amount / 1e12;

        vm.prank(alice);
        ousdVault.requestWithdrawal(amount);

        // OUSD burned = full amount (including dust)
        assertEq(ousd.totalSupply(), supplyBefore - amount);

        if (expectedUsdc == 0) return; // Nothing to claim if amount < 1e12

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint256 usdcBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        ousdVault.claimWithdrawal(0);

        assertEq(usdc.balanceOf(alice) - usdcBefore, expectedUsdc);
    }

    /// @notice allocate respects vault buffer: strategy gets max(0, available - supply * buffer / 1e18)
    function testFuzz_allocate_respectsVaultBuffer(uint256 mintAmt, uint256 buffer) public {
        mintAmt = bound(mintAmt, 1e6, 1e10);
        buffer = bound(buffer, 0, 1e18);

        // Deploy and configure strategy
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        ousdVault.setDefaultStrategy(address(strategy));
        ousdVault.setVaultBuffer(buffer);
        vm.stopPrank();

        _mintOUSD(alice, mintAmt);

        // Allocate
        vm.prank(governor);
        ousdVault.allocate();

        uint256 totalSupply = ousd.totalSupply();
        // Target buffer in USDC = totalSupply * buffer / 1e18 / 1e12
        uint256 targetBufferUsdc = (totalSupply * buffer) / 1e18 / 1e12;

        // Vault USDC after allocate
        uint256 vaultUsdc = usdc.balanceOf(address(ousdVault));

        // Vault should hold at least targetBuffer (± 1 USDC for rounding)
        if (buffer > 0) {
            assertApproxEqAbs(vaultUsdc, targetBufferUsdc, 1e6); // 1 USDC tolerance
        }

        // Strategy balance should be the remainder
        uint256 strategyBal = usdc.balanceOf(address(strategy));
        // Total USDC in system should equal all minted USDC (200e6 from setUp + mintAmt)
        assertEq(vaultUsdc + strategyBal, 200e6 + mintAmt);
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
