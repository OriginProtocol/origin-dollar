// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OETHVault_Shared_Test} from "tests/unit/vault/OETHVault/shared/Shared.t.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";

contract Unit_Concrete_OETHVault_Allocate_Test is Unit_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ALLOCATE()
    //////////////////////////////////////////////////////

    function test_allocate_toDefaultStrategy() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.setDefaultStrategy(address(strategy));

        vm.prank(governor);
        oethVault.allocate();

        // All 200 WETH should be allocated (no vault buffer set)
        assertEq(weth.balanceOf(address(strategy)), 200e18, "Strategy should receive WETH");
        assertEq(weth.balanceOf(address(oethVault)), 0, "Vault should be empty");
    }

    function test_allocate_respectsVaultBuffer() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        oethVault.setDefaultStrategy(address(strategy));
        oethVault.setVaultBuffer(5e17); // 50%
        vm.stopPrank();

        vm.prank(governor);
        oethVault.allocate();

        // With 50% buffer and 200 OETH supply: buffer = 100 WETH, allocate = 100 WETH
        assertEq(weth.balanceOf(address(strategy)), 100e18, "Strategy should receive 100 WETH");
        assertEq(weth.balanceOf(address(oethVault)), 100e18, "Vault should retain buffer");
    }

    function test_allocate_doesNothingWithoutStrategy() public {
        vm.prank(governor);
        oethVault.allocate();

        assertEq(weth.balanceOf(address(oethVault)), 200e18, "All WETH should stay in vault");
    }

    function test_allocate_doesNothingWithoutExcessFunds() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        oethVault.setDefaultStrategy(address(strategy));
        oethVault.setVaultBuffer(1e18); // 100% buffer
        vm.stopPrank();

        vm.prank(governor);
        oethVault.allocate();

        // 100% buffer means nothing to allocate
        assertEq(weth.balanceOf(address(strategy)), 0, "Strategy should receive nothing");
    }

    function test_allocate_reservesWETHForWithdrawalQueue() public {
        MockStrategy strategy = _deployAndApproveStrategy();
        vm.prank(governor);
        oethVault.setDefaultStrategy(address(strategy));

        // Request withdrawal of 50 OETH
        vm.prank(matt);
        oethVault.requestWithdrawal(50e18);

        vm.prank(governor);
        oethVault.allocate();

        // 200 WETH total, 50 reserved for queue → 150 WETH to strategy
        assertEq(weth.balanceOf(address(strategy)), 150e18, "Strategy should receive 150 WETH");
        assertEq(weth.balanceOf(address(oethVault)), 50e18, "Vault should retain 50 WETH for queue");
    }

    function test_allocate_emitsAssetAllocated() public {
        MockStrategy strategy = _deployAndApproveStrategy();
        vm.prank(governor);
        oethVault.setDefaultStrategy(address(strategy));

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.AssetAllocated(address(weth), address(strategy), 200e18);
        oethVault.allocate();
    }

    function test_allocate_withQueueAndClaimed() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.setDefaultStrategy(address(strategy));

        // daniel mints 30 WETH
        _mintOETH(daniel, 30e18);

        // Deposit all 230 WETH (200 setUp + 30 daniel) to strategy
        vm.prank(governor);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(230e18)));
        // Vault: 0 WETH, Strategy: 230 WETH

        vm.prank(daniel);
        oethVault.requestWithdrawal(10e18);
        vm.warp(block.timestamp + DELAY_PERIOD);

        // Strategist withdraws 10 WETH from strategy to vault for the claim
        vm.prank(strategist);
        oethVault.withdrawFromStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(10e18)));

        vm.prank(daniel);
        oethVault.claimWithdrawal(0);
        // So far: 10 WETH queued, 10 WETH claimed, Vault: 0 WETH, Strategy: 220 WETH

        vm.prank(daniel);
        oethVault.requestWithdrawal(10e18);
        // 20 WETH queued, 10 WETH claimed, need 10 WETH reserved for queue

        // Deposit 35 WETH. 10 WETH should remain for withdrawal, 25 to strategy.
        _mintOETH(daniel, 35e18);

        vm.prank(governor);
        oethVault.allocate();

        // Strategy: 220 + 25 = 245, Vault: 10 (reserved for queue)
        assertEq(weth.balanceOf(address(strategy)), 245e18, "Strategy balance after queue+claimed");
    }

    function test_allocate_withQueueClaimedAndBuffer() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.setDefaultStrategy(address(strategy));

        // daniel mints 40 WETH
        _mintOETH(daniel, 40e18);

        // Deposit all 240 WETH to strategy
        vm.prank(governor);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(240e18)));
        // Vault: 0 WETH, Strategy: 240 WETH

        vm.prank(daniel);
        oethVault.requestWithdrawal(10e18);
        vm.warp(block.timestamp + DELAY_PERIOD);

        // Withdraw 10 WETH from strategy for claim
        vm.prank(strategist);
        oethVault.withdrawFromStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(10e18)));

        vm.prank(daniel);
        oethVault.claimWithdrawal(0);
        // 10 WETH queued, 10 WETH claimed, Vault: 0 WETH, Strategy: 230 WETH

        vm.prank(daniel);
        oethVault.requestWithdrawal(10e18);
        // 20 WETH queued, 10 WETH claimed, need 10 WETH reserved

        // Set vault buffer to 5%
        vm.prank(governor);
        oethVault.setVaultBuffer(5e16);

        // Deposit 40 WETH
        _mintOETH(daniel, 40e18);

        vm.prank(governor);
        oethVault.allocate();

        // Total supply after: 200 + 40 - 10 - 10 + 40 = 260 OETH
        // Buffer = 260 * 5% = 13 WETH
        // Reserved for queue = 20 - 10 = 10 WETH
        // Available in vault = 40 - 10 = 30
        // Allocate: 30 - 13 = 17
        // Strategy: 230 + 17 = 247
        assertEq(weth.balanceOf(address(strategy)), 247e18, "Strategy balance with buffer+queue");
    }

    function test_allocate_belowThreshold_noAllocation() public {
        // Set auto allocate threshold to 100 WETH
        vm.prank(governor);
        oethVault.setAutoAllocateThreshold(100e18);

        MockStrategy strategy = _deployAndApproveStrategy();
        vm.prank(governor);
        oethVault.setDefaultStrategy(address(strategy));

        // Mint for 10 WETH — below 100 WETH threshold
        _dealWETH(daniel, 10e18);
        vm.startPrank(daniel);
        weth.approve(address(oethVault), 10e18);

        // Should not emit AssetAllocated
        vm.recordLogs();
        oethVault.mint(10e18);
        vm.stopPrank();

        assertEq(weth.balanceOf(address(strategy)), 0, "Strategy should receive nothing below threshold");
    }

    function test_allocate_noAvailableWETH_noAllocation() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.setDefaultStrategy(address(strategy));

        // Mint will allocate all to default strategy bc no buffer, no threshold
        _mintOETH(daniel, 10e18);
        vm.prank(daniel);
        oethVault.requestWithdrawal(5e18);

        uint256 stratBefore = weth.balanceOf(address(strategy));

        // Deposit less than queued amount (5 WETH) => _wethAvailable() return 0
        _mintOETH(daniel, 3e18);

        assertEq(weth.balanceOf(address(strategy)), stratBefore, "Strategy should not receive more WETH");
    }

    function test_allocate_belowBuffer_noAllocation() public {
        _mintOETH(daniel, 100e18);

        MockStrategy strategy = _deployAndApproveStrategy();
        vm.startPrank(governor);
        oethVault.setDefaultStrategy(address(strategy));
        oethVault.setVaultBuffer(5e16); // 5%
        vm.stopPrank();

        // OETH total supply = 300 (200 setUp + 100 daniel)
        // Second deposit of 5 WETH: total supply = 305, buffer = 305 * 5% = 15.25 WETH
        // 5 WETH is below buffer
        _dealWETH(daniel, 5e18);
        vm.startPrank(daniel);
        weth.approve(address(oethVault), 5e18);
        oethVault.mint(5e18);
        vm.stopPrank();

        assertEq(weth.balanceOf(address(strategy)), 0, "Strategy should not receive WETH below buffer");
    }

    //////////////////////////////////////////////////////
    /// --- DEPOSITTOSTRATEGY()
    //////////////////////////////////////////////////////

    function test_depositToStrategy_happyPath() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(100e18)));

        assertEq(weth.balanceOf(address(strategy)), 100e18, "Strategy should receive 100 WETH");
        assertEq(weth.balanceOf(address(oethVault)), 100e18, "Vault should retain 100 WETH");
    }

    function test_depositToStrategy_strategist() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(strategist);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(50e18)));

        assertEq(weth.balanceOf(address(strategy)), 50e18);
    }

    function test_depositToStrategy_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        oethVault.depositToStrategy(alice, _toArray(address(weth)), _toArray(uint256(1)));
    }

    function test_depositToStrategy_RevertWhen_unapproved() public {
        MockStrategy fakeStrategy = new MockStrategy();

        vm.prank(governor);
        vm.expectRevert("Invalid to Strategy");
        oethVault.depositToStrategy(address(fakeStrategy), _toArray(address(weth)), _toArray(uint256(100e18)));
    }

    function test_depositToStrategy_RevertWhen_wrongAsset() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        vm.expectRevert("Only asset is supported");
        oethVault.depositToStrategy(address(strategy), _toArray(address(oeth)), _toArray(uint256(100e18)));
    }

    function test_depositToStrategy_RevertWhen_notEnoughAvailable() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        // Request withdrawal of 180 OETH, leaving only 20 WETH available
        vm.prank(matt);
        oethVault.requestWithdrawal(100e18);
        vm.prank(josh);
        oethVault.requestWithdrawal(80e18);

        vm.prank(governor);
        vm.expectRevert("Not enough assets available");
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(30e18)));
    }

    //////////////////////////////////////////////////////
    /// --- WITHDRAWFROMSTRATEGY()
    //////////////////////////////////////////////////////

    function test_withdrawFromStrategy_happyPath() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        // First deposit
        vm.prank(governor);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(100e18)));

        // Then withdraw
        vm.prank(governor);
        oethVault.withdrawFromStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(50e18)));

        assertEq(weth.balanceOf(address(strategy)), 50e18, "Strategy should have 50 WETH remaining");
        assertEq(weth.balanceOf(address(oethVault)), 150e18, "Vault should have 150 WETH");
    }

    function test_withdrawFromStrategy_addsQueueLiquidity() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        // Deposit to strategy
        vm.prank(governor);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(150e18)));

        // Request withdrawal (50 WETH in vault, request 80 OETH)
        vm.prank(matt);
        oethVault.requestWithdrawal(80e18);

        uint128 claimableBefore = oethVault.withdrawalQueueMetadata().claimable;

        // Withdraw from strategy adds liquidity to queue
        vm.prank(governor);
        oethVault.withdrawFromStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(100e18)));

        uint128 claimableAfter = oethVault.withdrawalQueueMetadata().claimable;
        assertGt(claimableAfter, claimableBefore, "Claimable should increase after strategy withdrawal");
    }

    function test_withdrawFromStrategy_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        oethVault.withdrawFromStrategy(alice, _toArray(address(weth)), _toArray(uint256(1)));
    }

    function test_withdrawFromStrategy_RevertWhen_unapproved() public {
        MockStrategy fakeStrategy = new MockStrategy();

        vm.prank(governor);
        vm.expectRevert("Invalid from Strategy");
        oethVault.withdrawFromStrategy(address(fakeStrategy), _toArray(address(weth)), _toArray(uint256(100e18)));
    }

    //////////////////////////////////////////////////////
    /// --- WITHDRAWALLFROMSTRATEGY()
    //////////////////////////////////////////////////////

    function test_withdrawAllFromStrategy_happyPath() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(100e18)));

        vm.prank(governor);
        oethVault.withdrawAllFromStrategy(address(strategy));

        assertEq(weth.balanceOf(address(strategy)), 0, "Strategy should be empty");
        assertEq(weth.balanceOf(address(oethVault)), 200e18, "Vault should have all WETH back");
    }

    function test_withdrawAllFromStrategy_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        oethVault.withdrawAllFromStrategy(alice);
    }

    function test_withdrawAllFromStrategy_RevertWhen_notSupported() public {
        vm.prank(governor);
        vm.expectRevert("Strategy is not supported");
        oethVault.withdrawAllFromStrategy(alice);
    }

    //////////////////////////////////////////////////////
    /// --- WITHDRAWALLFROMSTRATEGIES()
    //////////////////////////////////////////////////////

    function test_withdrawAllFromStrategies_happyPath() public {
        MockStrategy strategy1 = _deployAndApproveStrategy();
        MockStrategy strategy2 = _deployAndApproveStrategy();

        vm.startPrank(governor);
        oethVault.depositToStrategy(address(strategy1), _toArray(address(weth)), _toArray(uint256(80e18)));
        oethVault.depositToStrategy(address(strategy2), _toArray(address(weth)), _toArray(uint256(60e18)));
        vm.stopPrank();

        assertEq(weth.balanceOf(address(oethVault)), 60e18, "Vault should have 60 WETH remaining");

        vm.prank(governor);
        oethVault.withdrawAllFromStrategies();

        assertEq(weth.balanceOf(address(strategy1)), 0, "Strategy 1 should be empty");
        assertEq(weth.balanceOf(address(strategy2)), 0, "Strategy 2 should be empty");
        assertEq(weth.balanceOf(address(oethVault)), 200e18, "Vault should have all WETH back");
    }

    function test_withdrawAllFromStrategies_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        oethVault.withdrawAllFromStrategies();
    }

    //////////////////////////////////////////////////////
    /// --- ALLOCATE() — CAPITAL PAUSED & NO AVAILABLE ASSET
    //////////////////////////////////////////////////////

    function test_allocate_RevertWhen_capitalPaused() public {
        vm.prank(governor);
        oethVault.pauseCapital();

        vm.prank(governor);
        vm.expectRevert("Capital paused");
        oethVault.allocate();
    }

    function test_allocate_returnsEarlyWhenNoAssetAvailable() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        oethVault.setDefaultStrategy(address(strategy));
        // Disable solvency check — requesting all OETH makes totalValue = 0
        oethVault.setMaxSupplyDiff(0);
        vm.stopPrank();

        // Request withdrawal of all WETH so _assetAvailable() returns 0
        vm.prank(matt);
        oethVault.requestWithdrawal(100e18);
        vm.prank(josh);
        oethVault.requestWithdrawal(100e18);

        vm.prank(governor);
        oethVault.allocate();

        // Strategy should receive nothing — all WETH reserved for withdrawal queue
        assertEq(weth.balanceOf(address(strategy)), 0, "Strategy should receive nothing");
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
