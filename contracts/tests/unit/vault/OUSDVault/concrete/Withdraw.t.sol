// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Shared_Test} from "tests/unit/vault/OUSDVault/shared/Shared.t.sol";
import {VaultStorage} from "contracts/vault/VaultStorage.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

contract Unit_Concrete_OUSDVault_Withdraw_Test is Unit_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- BASIC REQUEST / CLAIM  (~10 TESTS)
    //////////////////////////////////////////////////////

    function test_requestWithdrawal_firstRequest() public {
        _setupThreeUsersWithOUSD();

        VaultSnapshot memory before = _snap(daniel);

        vm.prank(daniel);
        ousdVault.requestWithdrawal(5e18);

        VaultSnapshot memory after_ = _snap(daniel);

        assertEq(after_.ousdTotalSupply, before.ousdTotalSupply - 5e18, "Total supply");
        assertEq(after_.userOusd, before.userOusd - 5e18, "User OUSD");
        assertEq(after_.vaultCheckBalance, before.vaultCheckBalance - 5e6, "Check balance");
    }

    function test_requestWithdrawal_emitsEvent() public {
        _setupThreeUsersWithOUSD();

        // requestId = 2 (0 and 1 used in drain)
        // queued = 200e6 (from drain) + 5e6 = 205e6
        vm.prank(daniel);
        vm.expectEmit(true, true, true, true);
        emit VaultStorage.WithdrawalRequested(daniel, 2, 5e18, 205e6);
        ousdVault.requestWithdrawal(5e18);
    }

    function test_requestWithdrawal_secondRequest() public {
        _setupThreeUsersWithOUSD();

        vm.prank(daniel);
        ousdVault.requestWithdrawal(5e18);

        VaultSnapshot memory before = _snap(matt);

        vm.prank(matt);
        ousdVault.requestWithdrawal(18e18);

        VaultSnapshot memory after_ = _snap(matt);
        assertEq(after_.ousdTotalSupply, before.ousdTotalSupply - 18e18, "Total supply");
        assertEq(after_.userOusd, before.userOusd - 18e18, "User OUSD");
    }

    function test_requestWithdrawal_RevertWhen_zeroAmount() public {
        _setupThreeUsersWithOUSD();

        vm.prank(josh);
        vm.expectRevert("Amount must be greater than 0");
        ousdVault.requestWithdrawal(0);
    }

    function test_requestWithdrawal_RevertWhen_capitalPaused() public {
        _setupThreeUsersWithOUSD();

        vm.prank(governor);
        ousdVault.pauseCapital();

        vm.prank(josh);
        vm.expectRevert("Capital paused");
        ousdVault.requestWithdrawal(5e18);
    }

    function test_requestWithdrawal_RevertWhen_asyncNotEnabled() public {
        _setupThreeUsersWithOUSD();

        vm.prank(governor);
        ousdVault.setWithdrawalClaimDelay(0);

        vm.prank(josh);
        vm.expectRevert("Async withdrawals not enabled");
        ousdVault.requestWithdrawal(5e18);
    }

    function test_requestWithdrawal_RevertWhen_insufficientBalance() public {
        _setupThreeUsersWithOUSD();

        // Josh has 20 OUSD, try to withdraw 21
        vm.prank(josh);
        vm.expectRevert("Transfer amount exceeds balance");
        ousdVault.requestWithdrawal(21e18);
    }

    //////////////////////////////////////////////////////
    /// --- ADDWITHDRAWALQUEUELIQUIDITY  (~3 TESTS)
    //////////////////////////////////////////////////////

    function test_addWithdrawalQueueLiquidity_addsClaimable() public {
        _setupThreeUsersWithOUSD();

        vm.prank(daniel);
        ousdVault.requestWithdrawal(5e18);
        vm.prank(josh);
        ousdVault.requestWithdrawal(18e18);

        vm.prank(josh);
        ousdVault.addWithdrawalQueueLiquidity();

        (, uint128 claimable,,) = ousdVault.withdrawalQueueMetadata();
        // 200e6 (from initial drain claims) + 5e6 + 18e6 = 223e6
        assertEq(claimable, 223e6, "Claimable should cover all requests");
    }

    function test_addWithdrawalQueueLiquidity_emitsEvent() public {
        _setupThreeUsersWithOUSD();

        vm.prank(daniel);
        ousdVault.requestWithdrawal(5e18);

        vm.expectEmit(true, true, true, true);
        emit VaultStorage.WithdrawalClaimable(205e6, 5e6);
        ousdVault.addWithdrawalQueueLiquidity();
    }

    function test_addWithdrawalQueueLiquidity_noopWhenFullyFunded() public {
        _setupThreeUsersWithOUSD();

        // No pending withdrawals beyond what's already claimable
        ousdVault.addWithdrawalQueueLiquidity();
        (, uint128 claimableBefore,,) = ousdVault.withdrawalQueueMetadata();

        ousdVault.addWithdrawalQueueLiquidity();
        (, uint128 claimableAfter,,) = ousdVault.withdrawalQueueMetadata();

        assertEq(claimableBefore, claimableAfter, "Should not change");
    }

    //////////////////////////////////////////////////////
    /// --- CLAIM WITH 60 USDC IN VAULT  (~15 TESTS)
    //////////////////////////////////////////////////////

    function test_claimWithdrawal_single() public {
        _setupThreeUsersWithOUSD();

        vm.prank(daniel);
        ousdVault.requestWithdrawal(5e18);
        vm.prank(josh);
        ousdVault.requestWithdrawal(18e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        VaultSnapshot memory before = _snap(josh);

        vm.prank(josh);
        ousdVault.claimWithdrawal(3);

        VaultSnapshot memory after_ = _snap(josh);
        assertEq(after_.userUsdc, before.userUsdc + 18e6, "User USDC should increase");
        assertEq(after_.vaultUsdc, before.vaultUsdc - 18e6, "Vault USDC should decrease");
    }

    function test_claimWithdrawal_emitsEvent() public {
        _setupThreeUsersWithOUSD();

        vm.prank(daniel);
        ousdVault.requestWithdrawal(5e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(daniel);
        vm.expectEmit(true, true, true, true);
        emit VaultStorage.WithdrawalClaimed(daniel, 2, 5e18);
        ousdVault.claimWithdrawal(2);
    }

    function test_claimWithdrawals_batch() public {
        _setupThreeUsersWithOUSD();

        vm.startPrank(matt);
        ousdVault.requestWithdrawal(5e18);
        ousdVault.requestWithdrawal(18e18);
        vm.stopPrank();

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint256[] memory ids = new uint256[](2);
        ids[0] = 2;
        ids[1] = 3;

        VaultSnapshot memory before = _snap(matt);

        vm.prank(matt);
        (uint256[] memory amounts, uint256 totalAmount) = ousdVault.claimWithdrawals(ids);

        assertEq(amounts.length, 2, "Should return 2 amounts");
        assertEq(amounts[0], 5e6, "First claim amount mismatch");
        assertEq(amounts[1], 18e6, "Second claim amount mismatch");
        assertEq(totalAmount, 23e6, "Total amount mismatch");

        VaultSnapshot memory after_ = _snap(matt);
        assertEq(after_.userUsdc, before.userUsdc + 23e6, "Batch claim USDC mismatch");
    }

    function test_claimWithdrawal_RevertWhen_delayNotMet() public {
        _setupThreeUsersWithOUSD();

        vm.prank(daniel);
        ousdVault.requestWithdrawal(5e18);

        // Don't advance time
        vm.prank(daniel);
        vm.expectRevert("Claim delay not met");
        ousdVault.claimWithdrawal(2);
    }

    function test_claimWithdrawal_RevertWhen_wrongRequester() public {
        _setupThreeUsersWithOUSD();

        vm.prank(daniel);
        ousdVault.requestWithdrawal(5e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt); // Matt trying to claim Daniel's request
        vm.expectRevert("Not requester");
        ousdVault.claimWithdrawal(2);
    }

    function test_claimWithdrawal_RevertWhen_alreadyClaimed() public {
        _setupThreeUsersWithOUSD();

        vm.prank(daniel);
        ousdVault.requestWithdrawal(5e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(daniel);
        ousdVault.claimWithdrawal(2);

        vm.prank(daniel);
        vm.expectRevert("Already claimed");
        ousdVault.claimWithdrawal(2);
    }

    function test_claimWithdrawal_whale() public {
        _setupThreeUsersWithOUSD();

        assertEq(ousd.balanceOf(matt), 30e18);
        uint256 totalValueBefore = ousdVault.totalValue();

        vm.prank(matt);
        ousdVault.requestWithdrawal(30e18);

        assertEq(ousd.balanceOf(matt), 0, "Matt OUSD should be 0 after request");
        assertEq(ousdVault.totalValue(), totalValueBefore - 30e18);

        uint256 totalSupplyAfterRequest = ousd.totalSupply();
        uint256 totalValueAfterRequest = ousdVault.totalValue();

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        vm.expectEmit(true, true, true, true);
        emit VaultStorage.WithdrawalClaimed(matt, 2, 30e18);
        ousdVault.claimWithdrawal(2);

        // Total supply and value should not change after claim (OUSD already burned during request)
        assertEq(ousd.totalSupply(), totalSupplyAfterRequest, "Supply unchanged after claim");
        assertEq(ousdVault.totalValue(), totalValueAfterRequest, "Value unchanged after claim");
    }

    //////////////////////////////////////////////////////
    /// --- SOLVENCY CHECKS — OVER-BACKED / UNDER-BACKED
    //////////////////////////////////////////////////////

    function test_requestWithdrawal_RevertWhen_overBacked() public {
        _setupThreeUsersWithOUSD();

        // Transfer extra USDC to vault to make it over-backed (beyond 3% diff)
        _dealUSDC(daniel, 10e18); // 10e18 in 6-decimal units = 10e18 USDC
        vm.prank(daniel);
        usdc.transfer(address(ousdVault), 10e18);

        vm.prank(daniel);
        vm.expectRevert("Backing supply liquidity error");
        ousdVault.requestWithdrawal(5e18);
    }

    function test_requestWithdrawal_RevertWhen_underBacked() public {
        _setupThreeUsersWithOUSD();

        // Simulate loss: vault loses USDC
        vm.prank(address(ousdVault));
        usdc.transfer(daniel, 10e6);

        vm.prank(daniel);
        vm.expectRevert("Backing supply liquidity error");
        ousdVault.requestWithdrawal(5e18);
    }

    function test_claimWithdrawal_RevertWhen_overBacked() public {
        _setupThreeUsersWithOUSD();

        vm.prank(daniel);
        ousdVault.requestWithdrawal(5e18);

        // Transfer USDC to vault to make it over-backed
        _dealUSDC(daniel, 10e18);
        vm.prank(daniel);
        usdc.transfer(address(ousdVault), 10e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(daniel);
        vm.expectRevert("Backing supply liquidity error");
        ousdVault.claimWithdrawal(2);
    }

    function test_claimWithdrawals_RevertWhen_overBacked() public {
        _setupThreeUsersWithOUSD();

        vm.startPrank(matt);
        ousdVault.requestWithdrawal(5e18);
        ousdVault.requestWithdrawal(18e18);
        vm.stopPrank();

        _dealUSDC(matt, 10e18);
        vm.prank(matt);
        usdc.transfer(address(ousdVault), 10e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint256[] memory ids = new uint256[](2);
        ids[0] = 2;
        ids[1] = 3;
        vm.prank(matt);
        vm.expectRevert("Backing supply liquidity error");
        ousdVault.claimWithdrawals(ids);
    }

    //////////////////////////////////////////////////////
    /// --- STRATEGY + QUEUE INTERACTIONS  (~10 TESTS)
    //////////////////////////////////////////////////////

    function test_strategy_depositRevertWhenUSDCReserved() public {
        MockStrategy strategy = _setupStrategyWith15USDC();

        // 45 USDC in vault, 23 reserved for queue → 22 available
        // Try deposit 23 → should fail
        vm.prank(governor);
        vm.expectRevert("Not enough assets available");
        ousdVault.depositToStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(23e6)));
    }

    function test_strategy_depositUnallocatedUSDC() public {
        MockStrategy strategy = _setupStrategyWith15USDC();

        // 22 USDC available
        vm.prank(governor);
        ousdVault.depositToStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(22e6)));
    }

    function test_strategy_allocateRespectsQueueAndBuffer() public {
        MockStrategy strategy = _setupStrategyWith15USDC();

        vm.startPrank(governor);
        ousdVault.setDefaultStrategy(address(strategy));
        ousdVault.setVaultBuffer(1e17); // 10%
        vm.stopPrank();

        vm.prank(governor);
        ousdVault.allocate();

        // 45 USDC in vault, 23 reserved → 22 unreserved
        // 10% buffer of ~37 OUSD supply = ~3.7 USDC
        // Allocate ~22 - 3.7 = ~18.3 USDC
        assertApproxEqAbs(usdc.balanceOf(address(strategy)), 15e6 + 18.3e6, 0.1e6, "Strategy balance");
    }

    function test_claimAfterWithdrawFromStrategy() public {
        MockStrategy strategy = _setupStrategyWith15USDC();

        ousdVault.addWithdrawalQueueLiquidity();

        // Matt requests 30 OUSD (8 USDC short)
        vm.prank(matt);
        ousdVault.requestWithdrawal(30e18);

        // Withdraw 8 USDC from strategy
        vm.prank(strategist);
        ousdVault.withdrawFromStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(8e6)));

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        ousdVault.claimWithdrawal(4); // Should succeed now
    }

    function test_claimAfterWithdrawAllFromStrategy() public {
        MockStrategy strategy = _setupStrategyWith15USDC();

        ousdVault.addWithdrawalQueueLiquidity();

        vm.prank(matt);
        ousdVault.requestWithdrawal(30e18);

        vm.prank(strategist);
        ousdVault.withdrawAllFromStrategy(address(strategy));

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        ousdVault.claimWithdrawal(4);
    }

    function test_claimAfterWithdrawAllFromStrategies() public {
        _setupStrategyWith15USDC();

        ousdVault.addWithdrawalQueueLiquidity();

        vm.prank(matt);
        ousdVault.requestWithdrawal(30e18);

        vm.prank(strategist);
        ousdVault.withdrawAllFromStrategies();

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        ousdVault.claimWithdrawal(4);
    }

    function test_claimAfterMintAddsLiquidity() public {
        _setupStrategyWith15USDC();

        ousdVault.addWithdrawalQueueLiquidity();

        // Matt requests 30 OUSD (8 USDC short)
        vm.prank(matt);
        ousdVault.requestWithdrawal(30e18);

        // Daniel mints 8 USDC worth of OUSD — this adds liquidity to the queue
        _mintOUSD(daniel, 8e6);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        ousdVault.claimWithdrawal(4);
    }

    function test_claimRevertWhenMintNotEnoughLiquidity() public {
        _setupStrategyWith15USDC();

        // Matt requests 30 OUSD (8 USDC short). Mint only 6 USDC.
        vm.prank(matt);
        ousdVault.requestWithdrawal(30e18);

        _mintOUSD(daniel, 6e6);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        vm.expectRevert("Queue pending liquidity");
        ousdVault.claimWithdrawal(4);
    }

    //////////////////////////////////////////////////////
    /// --- EXACT COVERAGE / MINT SCENARIOS  (~5 TESTS)
    //////////////////////////////////////////////////////

    function test_mintCoversExactlyOutstandingRequests() public {
        // Setup: 15 USDC in vault, 85 in strategy, 32 USDC in queue, 5 already claimed
        _drainInitialOUSD();

        _mintOUSD(daniel, 15e6);
        _mintOUSD(josh, 20e6);
        _mintOUSD(matt, 30e6);
        _mintOUSD(domen, 40e6);

        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(3e16);

        // Request+claim 5 USDC
        vm.prank(daniel);
        ousdVault.requestWithdrawal(2e18);
        vm.prank(josh);
        ousdVault.requestWithdrawal(3e18);
        vm.warp(block.timestamp + DELAY_PERIOD);
        vm.prank(daniel);
        ousdVault.claimWithdrawal(2);
        vm.prank(josh);
        ousdVault.claimWithdrawal(3);

        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        ousdVault.depositToStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(85e6)));

        vm.prank(governor);
        ousdVault.setVaultBuffer(1e16); // 1%

        // 32 OUSD outstanding requests
        vm.prank(daniel);
        ousdVault.requestWithdrawal(4e18);
        vm.prank(josh);
        ousdVault.requestWithdrawal(12e18);
        vm.prank(matt);
        ousdVault.requestWithdrawal(16e18);

        ousdVault.addWithdrawalQueueLiquidity();

        // Mint 17 USDC = exactly covers outstanding 32 - 15 in vault = 17
        _mintOUSD(daniel, 17e6);

        vm.warp(block.timestamp + DELAY_PERIOD);

        // Should be able to claim all 3 requests
        vm.prank(daniel);
        ousdVault.claimWithdrawal(4);
        vm.prank(josh);
        ousdVault.claimWithdrawal(5);
        vm.prank(matt);
        ousdVault.claimWithdrawal(6);
    }

    function test_mintCoversOutstandingPlusBuffer() public {
        _drainInitialOUSD();

        _mintOUSD(daniel, 15e6);
        _mintOUSD(josh, 20e6);
        _mintOUSD(matt, 30e6);
        _mintOUSD(domen, 40e6);

        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(3e16);

        vm.prank(daniel);
        ousdVault.requestWithdrawal(2e18);
        vm.prank(josh);
        ousdVault.requestWithdrawal(3e18);
        vm.warp(block.timestamp + DELAY_PERIOD);
        vm.prank(daniel);
        ousdVault.claimWithdrawal(2);
        vm.prank(josh);
        ousdVault.claimWithdrawal(3);

        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        ousdVault.depositToStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(85e6)));

        vm.prank(governor);
        ousdVault.setVaultBuffer(1e16); // 1%

        vm.prank(daniel);
        ousdVault.requestWithdrawal(4e18);
        vm.prank(josh);
        ousdVault.requestWithdrawal(12e18);
        vm.prank(matt);
        ousdVault.requestWithdrawal(16e18);

        ousdVault.addWithdrawalQueueLiquidity();

        // Mint 18 USDC = covers outstanding + ~1 USDC vault buffer
        _mintOUSD(daniel, 18e6);

        // Should be able to deposit 1 USDC to strategy
        vm.prank(governor);
        ousdVault.depositToStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(1e6)));
    }

    //////////////////////////////////////////////////////
    /// --- FULL DRAIN / EDGE CASES  (~5 TESTS)
    //////////////////////////////////////////////////////

    function test_lastUserRequestsRemainingUSDC() public {
        _drainInitialOUSD();

        _mintOUSD(daniel, 10e6);
        _mintOUSD(josh, 20e6);
        _mintOUSD(matt, 10e6);

        // Disable solvency check for full drain scenarios
        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(0);

        // Request + claim 30 USDC
        vm.prank(daniel);
        ousdVault.requestWithdrawal(10e18);
        vm.prank(josh);
        ousdVault.requestWithdrawal(20e18);
        vm.warp(block.timestamp + DELAY_PERIOD);
        vm.prank(daniel);
        ousdVault.claimWithdrawal(2);
        vm.prank(josh);
        ousdVault.claimWithdrawal(3);

        // Matt requests the remaining 10 USDC
        vm.prank(matt);
        ousdVault.requestWithdrawal(10e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        ousdVault.claimWithdrawal(4);

        assertEq(ousdVault.totalValue(), 0, "Total value should be 0 after full drain");
    }

    function test_claimSmallerThanAvailable() public {
        _drainInitialOUSD();

        _mintOUSD(daniel, 10e6);
        _mintOUSD(josh, 20e6);
        _mintOUSD(matt, 70e6);

        vm.prank(matt);
        ousdVault.requestWithdrawal(40e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint256 joshUsdcBefore = usdc.balanceOf(josh);

        // Josh requests 20 which is smaller than 60 available
        vm.prank(josh);
        ousdVault.requestWithdrawal(20e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(josh);
        ousdVault.claimWithdrawal(3);

        assertEq(usdc.balanceOf(josh) - joshUsdcBefore, 20e6, "Josh should receive 20 USDC");
    }

    function test_claimExactlyAvailable() public {
        _drainInitialOUSD();

        _mintOUSD(daniel, 10e6);
        _mintOUSD(josh, 20e6);
        _mintOUSD(matt, 70e6);

        vm.prank(matt);
        ousdVault.requestWithdrawal(40e18);
        vm.warp(block.timestamp + DELAY_PERIOD);
        vm.prank(matt);
        ousdVault.claimWithdrawal(2);

        // Transfer all OUSD to matt
        vm.prank(josh);
        ousd.transfer(matt, 20e18);
        vm.prank(daniel);
        ousd.transfer(matt, 10e18);

        // Disable solvency check — matt is draining all remaining OUSD
        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(0);

        // Matt requests remaining 60 OUSD
        vm.prank(matt);
        ousdVault.requestWithdrawal(60e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        ousdVault.claimWithdrawal(3);

        assertEq(usdc.balanceOf(address(ousdVault)), 0, "Vault should be empty");
    }

    function test_claimMoreThanAvailable_reverts() public {
        _drainInitialOUSD();

        _mintOUSD(daniel, 10e6);
        _mintOUSD(josh, 20e6);
        _mintOUSD(matt, 70e6);

        vm.prank(matt);
        ousdVault.requestWithdrawal(40e18);
        vm.warp(block.timestamp + DELAY_PERIOD);
        vm.prank(matt);
        ousdVault.claimWithdrawal(2);

        vm.prank(josh);
        ousd.transfer(matt, 20e18);
        vm.prank(daniel);
        ousd.transfer(matt, 10e18);

        // Disable solvency check — matt is draining all remaining OUSD
        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(0);

        vm.prank(matt);
        ousdVault.requestWithdrawal(60e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        // Simulate vault losing 50 USDC
        vm.prank(address(ousdVault));
        usdc.transfer(governor, 50e6);

        vm.prank(matt);
        vm.expectRevert("Queue pending liquidity");
        ousdVault.claimWithdrawal(3);
    }

    //////////////////////////////////////////////////////
    /// --- INSOLVENCY / SLASH SCENARIOS  (~10 TESTS)
    //////////////////////////////////////////////////////

    function test_insolvency_totalValueZeroAfter2USDCSlash() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        // Slash 2 USDC from strategy
        vm.prank(address(strategy));
        usdc.transfer(governor, 2e6);

        // 100 from mints - 99 outstanding - 2 slash = -1 → 0
        assertEq(ousdVault.totalValue(), 0, "Total value should be 0");
    }

    function test_insolvency_checkBalanceZeroAfter2USDCSlash() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        vm.prank(address(strategy));
        usdc.transfer(governor, 2e6);

        assertEq(ousdVault.checkBalance(address(usdc)), 0, "Check balance should be 0");
    }

    function test_insolvency_requestRevertsTooManyOutstanding_2USDC() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        vm.prank(address(strategy));
        usdc.transfer(governor, 2e6);

        vm.prank(matt);
        vm.expectRevert("Too many outstanding requests");
        ousdVault.requestWithdrawal(1e18);
    }

    function test_insolvency_claimRevertsTooManyOutstanding_2USDC() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        vm.prank(address(strategy));
        usdc.transfer(governor, 2e6);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(daniel);
        vm.expectRevert("Too many outstanding requests");
        ousdVault.claimWithdrawal(2);
    }

    function test_insolvency_totalValueZeroAfter1USDCSlash() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        vm.prank(address(strategy));
        usdc.transfer(governor, 1e6);

        // 100 - 99 - 1 = 0
        assertEq(ousdVault.totalValue(), 0, "Total value should be 0 after 1 USDC slash");
    }

    function test_insolvency_requestRevertsTooManyOutstanding_1USDC() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        vm.prank(address(strategy));
        usdc.transfer(governor, 1e6);

        vm.prank(matt);
        vm.expectRevert("Too many outstanding requests");
        ousdVault.requestWithdrawal(1e18);
    }

    function test_insolvency_smallSlash_totalValueReduced() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        // Slash 0.02 USDC
        vm.prank(address(strategy));
        usdc.transfer(governor, 0.02e6);

        // 100 - 99 - 0.02 = 0.98 USDC total value
        assertEq(ousdVault.totalValue(), 0.98e18, "Total value should be 0.98");
    }

    function test_insolvency_requestRevertsBackingError_smallSlash() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        vm.prank(address(strategy));
        usdc.transfer(governor, 0.02e6);

        // 1 OUSD request should fail: supply / totalValue off by > 1%
        vm.prank(matt);
        vm.expectRevert("Too many outstanding requests");
        ousdVault.requestWithdrawal(1e18);
    }

    function test_insolvency_smallRequestRevertsBackingError() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        vm.prank(address(strategy));
        usdc.transfer(governor, 0.02e6);

        // Tiny request: totalValue = 0.98, supply after = ~0, diff check
        vm.prank(matt);
        vm.expectRevert("Backing supply liquidity error");
        ousdVault.requestWithdrawal(0.01e18);
    }

    //////////////////////////////////////////////////////
    /// --- SOLVENCY WITH 3% AND 10% MAXSUPPLYDIFF
    //////////////////////////////////////////////////////

    function test_solvencyAt3Pct_requestReverts() public {
        _setupSlashWith5Percent();

        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(3e16);

        vm.prank(matt);
        vm.expectRevert("Backing supply liquidity error");
        ousdVault.requestWithdrawal(1e18);
    }

    function test_solvencyAt3Pct_claimReverts() public {
        _setupSlashWith5Percent();

        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(3e16);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(daniel);
        vm.expectRevert("Backing supply liquidity error");
        ousdVault.claimWithdrawal(2);
    }

    function test_solvencyAt10Pct_requestSucceeds() public {
        _setupSlashWith5Percent();

        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(1e17); // 10%

        vm.prank(matt);
        ousdVault.requestWithdrawal(1e18);
    }

    function test_solvencyAt10Pct_claimSucceeds() public {
        _setupSlashWith5Percent();

        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(1e17); // 10%

        vm.prank(daniel);
        ousdVault.claimWithdrawal(2);
    }

    //////////////////////////////////////////////////////
    /// --- FIRST USER CLAIM IN SLASH SCENARIO
    //////////////////////////////////////////////////////

    function test_slashScenario_firstUserCanClaim() public {
        _setupSlashWith5Percent();

        // With no maxSupplyDiff check (set to 0), first user can claim
        vm.prank(daniel);
        ousdVault.claimWithdrawal(2);

        assertEq(usdc.balanceOf(daniel), 10e6);
    }

    function test_slashScenario_secondUserLacksLiquidity() public {
        _setupSlashWith5Percent();

        vm.prank(josh);
        vm.expectRevert("Queue pending liquidity");
        ousdVault.claimWithdrawal(3);
    }

    function test_slashScenario_requestWithSolvencyOff() public {
        _setupSlashWith5Percent();

        vm.prank(matt);
        ousdVault.requestWithdrawal(10e18);
        // Should succeed with maxSupplyDiff = 0
    }

    //////////////////////////////////////////////////////
    /// --- REBASE ON REDEEM (REBASETHRESHOLD)
    //////////////////////////////////////////////////////

    function test_requestWithdrawal_triggersRebaseWhenAboveThreshold() public {
        // Set rebaseThreshold so redeem triggers a rebase
        vm.prank(governor);
        ousdVault.setRebaseThreshold(10e18); // 10 OUSD

        // Simulate yield so rebase has something to distribute
        _dealUSDC(address(this), 2e6);
        MockERC20(address(usdc)).transfer(address(ousdVault), 2e6);

        uint256 mattBefore = ousd.balanceOf(matt);

        // Request > rebaseThreshold to trigger _rebase() in _postRedeem
        vm.prank(matt);
        ousdVault.requestWithdrawal(50e18);

        // Matt's remaining balance should reflect yield from rebase
        uint256 mattAfter = ousd.balanceOf(matt);
        // Matt had ~100 OUSD, requested 50, yield ~1 OUSD (his share of 2 OUSD)
        assertGt(mattAfter, mattBefore - 50e18, "Rebase should have distributed yield");
    }

    //////////////////////////////////////////////////////
    /// --- CLAIMWITHDRAWAL — CAPITAL PAUSED
    //////////////////////////////////////////////////////

    function test_claimWithdrawal_RevertWhen_capitalPaused() public {
        vm.prank(matt);
        ousdVault.requestWithdrawal(50e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(governor);
        ousdVault.pauseCapital();

        vm.prank(matt);
        vm.expectRevert("Capital paused");
        ousdVault.claimWithdrawal(0);
    }

    function test_claimWithdrawals_RevertWhen_capitalPaused() public {
        vm.prank(matt);
        ousdVault.requestWithdrawal(50e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(governor);
        ousdVault.pauseCapital();

        uint256[] memory ids = new uint256[](1);
        ids[0] = 0;

        vm.prank(matt);
        vm.expectRevert("Capital paused");
        ousdVault.claimWithdrawals(ids);
    }

    //////////////////////////////////////////////////////
    /// --- CLAIMWITHDRAWAL — ASYNC NOT ENABLED
    //////////////////////////////////////////////////////

    function test_claimWithdrawal_RevertWhen_asyncNotEnabled() public {
        // Disable async withdrawals
        vm.prank(governor);
        ousdVault.setWithdrawalClaimDelay(0);

        vm.prank(matt);
        vm.expectRevert("Async withdrawals not enabled");
        ousdVault.claimWithdrawal(0);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    struct VaultSnapshot {
        uint256 ousdTotalSupply;
        uint256 ousdTotalValue;
        uint256 vaultCheckBalance;
        uint256 userOusd;
        uint256 userUsdc;
        uint256 vaultUsdc;
        uint128 queued;
        uint128 claimable;
        uint128 claimed;
        uint128 nextWithdrawalIndex;
    }

    function _snap(address user) internal view returns (VaultSnapshot memory s) {
        s.ousdTotalSupply = ousd.totalSupply();
        s.ousdTotalValue = ousdVault.totalValue();
        s.vaultCheckBalance = ousdVault.checkBalance(address(usdc));
        s.userOusd = ousd.balanceOf(user);
        s.userUsdc = usdc.balanceOf(user);
        s.vaultUsdc = usdc.balanceOf(address(ousdVault));
        (s.queued, s.claimable, s.claimed, s.nextWithdrawalIndex) = ousdVault.withdrawalQueueMetadata();
    }

    function _toArray(address a) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }

    function _toArray(uint256 a) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](1);
        arr[0] = a;
    }

    /// @dev Drain the initial 200 OUSD minted in setUp (matt+josh 100 each)
    function _drainInitialOUSD() internal {
        // Disable solvency check during drain (totalValue goes to 0)
        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(0);

        vm.prank(josh);
        ousdVault.requestWithdrawal(100e18);
        vm.prank(matt);
        ousdVault.requestWithdrawal(100e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(josh);
        ousdVault.claimWithdrawal(0);
        vm.prank(matt);
        ousdVault.claimWithdrawal(1);

        // Restore default solvency check
        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(5e16);
    }

    /// @dev Fund daniel(10), josh(20), matt(30) with USDC and mint OUSD. Set maxSupplyDiff to 3%.
    function _setupThreeUsersWithOUSD() internal {
        _drainInitialOUSD();

        _mintOUSD(daniel, 10e6);
        _mintOUSD(josh, 20e6);
        _mintOUSD(matt, 30e6);

        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(3e16); // 3%
    }

    /// @dev Deploy+approve strategy, deposit 15 USDC to it. Also request 5+18=23 OUSD withdrawals.
    function _setupStrategyWith15USDC() internal returns (MockStrategy strategy) {
        _setupThreeUsersWithOUSD();

        strategy = _deployAndApproveStrategy();

        // Deposit 15 USDC to strategy (leaves 45 USDC in vault)
        vm.prank(governor);
        ousdVault.depositToStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(15e6)));

        // Request 5 + 18 = 23 OUSD withdrawal (leaves 22 USDC unallocated)
        vm.prank(daniel);
        ousdVault.requestWithdrawal(5e18);
        vm.prank(josh);
        ousdVault.requestWithdrawal(18e18);
    }

    function _setupInsolvencyScenario() internal returns (MockStrategy strategy) {
        _drainInitialOUSD();

        _mintOUSD(daniel, 20e6);
        _mintOUSD(josh, 30e6);
        _mintOUSD(matt, 50e6);

        strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        ousdVault.setDefaultStrategy(address(strategy));

        vm.prank(governor);
        ousdVault.allocate(); // Send 100 USDC to strategy

        // Request 99 USDC withdrawal
        vm.prank(daniel);
        ousdVault.requestWithdrawal(20e18);
        vm.prank(josh);
        ousdVault.requestWithdrawal(30e18);
        vm.prank(matt);
        ousdVault.requestWithdrawal(49e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        // Withdraw 40 USDC from strategy to vault
        vm.prank(strategist);
        ousdVault.withdrawFromStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(40e6)));

        ousdVault.addWithdrawalQueueLiquidity();

        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(1e16); // 1%
    }

    function _setupSlashWith5Percent() internal returns (MockStrategy strategy) {
        _drainInitialOUSD();

        _mintOUSD(daniel, 10e6);
        _mintOUSD(josh, 20e6);
        _mintOUSD(matt, 30e6);

        strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        ousdVault.setDefaultStrategy(address(strategy));

        vm.prank(governor);
        ousdVault.allocate();

        // Request 40 USDC withdrawal
        vm.prank(daniel);
        ousdVault.requestWithdrawal(10e18);
        vm.prank(josh);
        ousdVault.requestWithdrawal(20e18);
        vm.prank(matt);
        ousdVault.requestWithdrawal(10e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        // Slash 1 USDC
        vm.prank(address(strategy));
        usdc.transfer(governor, 1e6);

        // Withdraw 15 USDC to vault
        vm.prank(strategist);
        ousdVault.withdrawFromStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(15e6)));

        ousdVault.addWithdrawalQueueLiquidity();

        // Initially maxSupplyDiff is 5% (set in setUp), turn it off for base state
        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(0);
    }
}
