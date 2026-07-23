// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_OETHVault_Shared_Test} from "tests/unit/vault/OETHVault/shared/Shared.t.sol";

// --- External libraries
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

// --- Project imports
import {IVault} from "contracts/interfaces/IVault.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";

contract Unit_Concrete_OETHVault_Withdraw_Test is Unit_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- BASIC REQUEST / CLAIM  (~7 TESTS)
    //////////////////////////////////////////////////////

    function test_requestWithdrawal_firstRequest() public {
        _setupThreeUsersWithOETH();

        VaultSnapshot memory before = _snap(daniel);

        vm.prank(daniel);
        oethVault.requestWithdrawal(5e18);

        VaultSnapshot memory after_ = _snap(daniel);

        assertEq(after_.oethTotalSupply, before.oethTotalSupply - 5e18, "Total supply");
        assertEq(after_.userOeth, before.userOeth - 5e18, "User OETH");
        assertEq(after_.vaultCheckBalance, before.vaultCheckBalance - 5e18, "Check balance");
    }

    function test_requestWithdrawal_emitsEvent() public {
        _setupThreeUsersWithOETH();

        // requestId = 2 (0 and 1 used in drain)
        // queued = 200e18 (from drain) + 5e18 = 205e18
        vm.prank(daniel);
        vm.expectEmit(true, true, true, true);
        emit IVault.WithdrawalRequested(daniel, 2, 5e18, 205e18);
        oethVault.requestWithdrawal(5e18);
    }

    function test_requestWithdrawal_secondRequest() public {
        _setupThreeUsersWithOETH();

        vm.prank(daniel);
        oethVault.requestWithdrawal(5e18);

        VaultSnapshot memory before = _snap(matt);

        vm.prank(matt);
        oethVault.requestWithdrawal(18e18);

        VaultSnapshot memory after_ = _snap(matt);
        assertEq(after_.oethTotalSupply, before.oethTotalSupply - 18e18, "Total supply");
        assertEq(after_.userOeth, before.userOeth - 18e18, "User OETH");
    }

    function test_requestWithdrawal_RevertWhen_zeroAmount() public {
        _setupThreeUsersWithOETH();

        vm.prank(josh);
        vm.expectRevert("Amount must be greater than 0");
        oethVault.requestWithdrawal(0);
    }

    function test_requestWithdrawal_RevertWhen_capitalPaused() public {
        _setupThreeUsersWithOETH();

        vm.prank(governor);
        oethVault.pauseCapital();

        vm.prank(josh);
        vm.expectRevert("Capital paused");
        oethVault.requestWithdrawal(5e18);
    }

    function test_requestWithdrawal_RevertWhen_asyncNotEnabled() public {
        _setupThreeUsersWithOETH();

        vm.prank(governor);
        oethVault.setWithdrawalClaimDelay(0);

        vm.prank(josh);
        vm.expectRevert("Async withdrawals not enabled");
        oethVault.requestWithdrawal(5e18);
    }

    function test_requestWithdrawal_RevertWhen_insufficientBalance() public {
        _setupThreeUsersWithOETH();

        // Josh has 20 OETH, try to withdraw 21
        vm.prank(josh);
        vm.expectRevert("Transfer amount exceeds balance");
        oethVault.requestWithdrawal(21e18);
    }

    //////////////////////////////////////////////////////
    /// --- ADDWITHDRAWALQUEUELIQUIDITY  (~3 TESTS)
    //////////////////////////////////////////////////////

    function test_addWithdrawalQueueLiquidity_addsClaimable() public {
        _setupThreeUsersWithOETH();

        vm.prank(daniel);
        oethVault.requestWithdrawal(5e18);
        vm.prank(josh);
        oethVault.requestWithdrawal(18e18);

        vm.prank(josh);
        oethVault.addWithdrawalQueueLiquidity();

        uint128 claimable = oethVault.withdrawalQueueMetadata().claimable;
        // 200e18 (from initial drain claims) + 5e18 + 18e18 = 223e18
        assertEq(claimable, 223e18, "Claimable should cover all requests");
    }

    function test_addWithdrawalQueueLiquidity_emitsEvent() public {
        _setupThreeUsersWithOETH();

        vm.prank(daniel);
        oethVault.requestWithdrawal(5e18);

        vm.expectEmit(true, true, true, true);
        emit IVault.WithdrawalClaimable(205e18, 5e18);
        oethVault.addWithdrawalQueueLiquidity();
    }

    function test_addWithdrawalQueueLiquidity_noopWhenFullyFunded() public {
        _setupThreeUsersWithOETH();

        // No pending withdrawals beyond what's already claimable
        oethVault.addWithdrawalQueueLiquidity();
        uint128 claimableBefore = oethVault.withdrawalQueueMetadata().claimable;

        oethVault.addWithdrawalQueueLiquidity();
        uint128 claimableAfter = oethVault.withdrawalQueueMetadata().claimable;

        assertEq(claimableBefore, claimableAfter, "Should not change");
    }

    //////////////////////////////////////////////////////
    /// --- CLAIM WITH 60 WETH IN VAULT  (~7 TESTS)
    //////////////////////////////////////////////////////

    function test_claimWithdrawal_single() public {
        _setupThreeUsersWithOETH();

        vm.prank(daniel);
        oethVault.requestWithdrawal(5e18);
        vm.prank(josh);
        oethVault.requestWithdrawal(18e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        VaultSnapshot memory before = _snap(josh);

        vm.prank(josh);
        oethVault.claimWithdrawal(3);

        VaultSnapshot memory after_ = _snap(josh);
        assertEq(after_.userWeth, before.userWeth + 18e18, "User WETH should increase");
        assertEq(after_.vaultWeth, before.vaultWeth - 18e18, "Vault WETH should decrease");
    }

    function test_claimWithdrawal_emitsEvent() public {
        _setupThreeUsersWithOETH();

        vm.prank(daniel);
        oethVault.requestWithdrawal(5e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(daniel);
        vm.expectEmit(true, true, true, true);
        emit IVault.WithdrawalClaimed(daniel, 2, 5e18);
        oethVault.claimWithdrawal(2);
    }

    function test_claimWithdrawals_batch() public {
        _setupThreeUsersWithOETH();

        vm.startPrank(matt);
        oethVault.requestWithdrawal(5e18);
        oethVault.requestWithdrawal(18e18);
        vm.stopPrank();

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint256[] memory ids = new uint256[](2);
        ids[0] = 2;
        ids[1] = 3;

        VaultSnapshot memory before = _snap(matt);

        vm.prank(matt);
        (uint256[] memory amounts, uint256 totalAmount) = oethVault.claimWithdrawals(ids);

        assertEq(amounts.length, 2, "Should return 2 amounts");
        assertEq(amounts[0], 5e18, "First claim amount mismatch");
        assertEq(amounts[1], 18e18, "Second claim amount mismatch");
        assertEq(totalAmount, 23e18, "Total amount mismatch");

        VaultSnapshot memory after_ = _snap(matt);
        assertEq(after_.userWeth, before.userWeth + 23e18, "Batch claim WETH mismatch");
    }

    function test_claimWithdrawal_RevertWhen_delayNotMet() public {
        _setupThreeUsersWithOETH();

        vm.prank(daniel);
        oethVault.requestWithdrawal(5e18);

        // Don't advance time
        vm.prank(daniel);
        vm.expectRevert("Claim delay not met");
        oethVault.claimWithdrawal(2);
    }

    function test_claimWithdrawal_RevertWhen_wrongRequester() public {
        _setupThreeUsersWithOETH();

        vm.prank(daniel);
        oethVault.requestWithdrawal(5e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt); // Matt trying to claim Daniel's request
        vm.expectRevert("Not requester");
        oethVault.claimWithdrawal(2);
    }

    function test_claimWithdrawal_RevertWhen_alreadyClaimed() public {
        _setupThreeUsersWithOETH();

        vm.prank(daniel);
        oethVault.requestWithdrawal(5e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(daniel);
        oethVault.claimWithdrawal(2);

        vm.prank(daniel);
        vm.expectRevert("Already claimed");
        oethVault.claimWithdrawal(2);
    }

    function test_claimWithdrawal_whale() public {
        _setupThreeUsersWithOETH();

        assertEq(oeth.balanceOf(matt), 30e18);
        uint256 totalValueBefore = oethVault.totalValue();

        vm.prank(matt);
        oethVault.requestWithdrawal(30e18);

        assertEq(oeth.balanceOf(matt), 0, "Matt OETH should be 0 after request");
        assertEq(oethVault.totalValue(), totalValueBefore - 30e18);

        uint256 totalSupplyAfterRequest = oeth.totalSupply();
        uint256 totalValueAfterRequest = oethVault.totalValue();

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        vm.expectEmit(true, true, true, true);
        emit IVault.WithdrawalClaimed(matt, 2, 30e18);
        oethVault.claimWithdrawal(2);

        // Total supply and value should not change after claim (OETH already burned during request)
        assertEq(oeth.totalSupply(), totalSupplyAfterRequest, "Supply unchanged after claim");
        assertEq(oethVault.totalValue(), totalValueAfterRequest, "Value unchanged after claim");
    }

    //////////////////////////////////////////////////////
    /// --- SOLVENCY CHECKS — OVER-BACKED / UNDER-BACKED
    //////////////////////////////////////////////////////

    function test_requestWithdrawal_RevertWhen_overBacked() public {
        _setupThreeUsersWithOETH();

        // Transfer extra WETH to vault to make it over-backed (beyond 3% diff)
        _dealWETH(daniel, 10e18);
        vm.prank(daniel);
        weth.transfer(address(oethVault), 10e18);

        vm.prank(daniel);
        vm.expectRevert("Backing supply liquidity error");
        oethVault.requestWithdrawal(5e18);
    }

    function test_requestWithdrawal_RevertWhen_underBacked() public {
        _setupThreeUsersWithOETH();

        // Simulate loss: vault loses WETH
        vm.prank(address(oethVault));
        weth.transfer(daniel, 10e18);

        vm.prank(daniel);
        vm.expectRevert("Backing supply liquidity error");
        oethVault.requestWithdrawal(5e18);
    }

    function test_claimWithdrawal_RevertWhen_overBacked() public {
        _setupThreeUsersWithOETH();

        vm.prank(daniel);
        oethVault.requestWithdrawal(5e18);

        // Transfer WETH to vault to make it over-backed
        _dealWETH(daniel, 10e18);
        vm.prank(daniel);
        weth.transfer(address(oethVault), 10e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(daniel);
        vm.expectRevert("Backing supply liquidity error");
        oethVault.claimWithdrawal(2);
    }

    function test_claimWithdrawals_RevertWhen_overBacked() public {
        _setupThreeUsersWithOETH();

        vm.startPrank(matt);
        oethVault.requestWithdrawal(5e18);
        oethVault.requestWithdrawal(18e18);
        vm.stopPrank();

        _dealWETH(matt, 10e18);
        vm.prank(matt);
        weth.transfer(address(oethVault), 10e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint256[] memory ids = new uint256[](2);
        ids[0] = 2;
        ids[1] = 3;
        vm.prank(matt);
        vm.expectRevert("Backing supply liquidity error");
        oethVault.claimWithdrawals(ids);
    }

    //////////////////////////////////////////////////////
    /// --- STRATEGY + QUEUE INTERACTIONS  (~8 TESTS)
    //////////////////////////////////////////////////////

    function test_strategy_depositRevertWhenWETHReserved() public {
        MockStrategy strategy = _setupStrategyWith15WETH();

        // 45 WETH in vault, 23 reserved for queue → 22 available
        // Try deposit 23 → should fail
        vm.prank(governor);
        vm.expectRevert("Not enough assets available");
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(23e18)));
    }

    function test_strategy_depositUnallocatedWETH() public {
        MockStrategy strategy = _setupStrategyWith15WETH();

        // 22 WETH available
        vm.prank(governor);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(22e18)));
    }

    function test_strategy_allocateRespectsQueueAndBuffer() public {
        MockStrategy strategy = _setupStrategyWith15WETH();

        vm.startPrank(governor);
        oethVault.setDefaultStrategy(address(strategy));
        oethVault.setVaultBuffer(1e17); // 10%
        vm.stopPrank();

        vm.prank(governor);
        oethVault.allocate();

        // 45 WETH in vault, 23 reserved → 22 unreserved
        // 10% buffer of ~37 OETH supply = ~3.7 WETH
        // Allocate ~22 - 3.7 = ~18.3 WETH
        assertApproxEqAbs(weth.balanceOf(address(strategy)), 15e18 + 18.3e18, 0.1e18, "Strategy balance");
    }

    function test_claimAfterWithdrawFromStrategy() public {
        MockStrategy strategy = _setupStrategyWith15WETH();

        oethVault.addWithdrawalQueueLiquidity();

        // Matt requests 30 OETH (8 WETH short)
        vm.prank(matt);
        oethVault.requestWithdrawal(30e18);

        // Withdraw 8 WETH from strategy
        vm.prank(strategist);
        oethVault.withdrawFromStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(8e18)));

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        oethVault.claimWithdrawal(4); // Should succeed now
    }

    function test_claimAfterWithdrawAllFromStrategy() public {
        MockStrategy strategy = _setupStrategyWith15WETH();

        oethVault.addWithdrawalQueueLiquidity();

        vm.prank(matt);
        oethVault.requestWithdrawal(30e18);

        vm.prank(strategist);
        oethVault.withdrawAllFromStrategy(address(strategy));

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        oethVault.claimWithdrawal(4);
    }

    function test_claimAfterWithdrawAllFromStrategies() public {
        _setupStrategyWith15WETH();

        oethVault.addWithdrawalQueueLiquidity();

        vm.prank(matt);
        oethVault.requestWithdrawal(30e18);

        vm.prank(strategist);
        oethVault.withdrawAllFromStrategies();

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        oethVault.claimWithdrawal(4);
    }

    function test_claimAfterMintAddsLiquidity() public {
        _setupStrategyWith15WETH();

        oethVault.addWithdrawalQueueLiquidity();

        // Matt requests 30 OETH (8 WETH short)
        vm.prank(matt);
        oethVault.requestWithdrawal(30e18);

        // Daniel mints 8 WETH worth of OETH — this adds liquidity to the queue
        _mintOETH(daniel, 8e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        oethVault.claimWithdrawal(4);
    }

    function test_claimRevertWhenMintNotEnoughLiquidity() public {
        _setupStrategyWith15WETH();

        // Matt requests 30 OETH (8 WETH short). Mint only 6 WETH.
        vm.prank(matt);
        oethVault.requestWithdrawal(30e18);

        _mintOETH(daniel, 6e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        vm.expectRevert("Queue pending liquidity");
        oethVault.claimWithdrawal(4);
    }

    //////////////////////////////////////////////////////
    /// --- EXACT COVERAGE / MINT SCENARIOS  (~3 TESTS)
    //////////////////////////////////////////////////////

    function test_mintCoversExactlyOutstandingRequests() public {
        // Setup: 15 WETH in vault, 85 in strategy, 32 WETH in queue, 5 already claimed
        _drainInitialOETH();

        _mintOETH(daniel, 15e18);
        _mintOETH(josh, 20e18);
        _mintOETH(matt, 30e18);
        _mintOETH(domen, 40e18);

        vm.prank(governor);
        oethVault.setMaxSupplyDiff(3e16);

        // Request+claim 5 WETH
        vm.prank(daniel);
        oethVault.requestWithdrawal(2e18);
        vm.prank(josh);
        oethVault.requestWithdrawal(3e18);
        vm.warp(block.timestamp + DELAY_PERIOD);
        vm.prank(daniel);
        oethVault.claimWithdrawal(2);
        vm.prank(josh);
        oethVault.claimWithdrawal(3);

        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(85e18)));

        vm.prank(governor);
        oethVault.setVaultBuffer(1e16); // 1%

        // 32 OETH outstanding requests
        vm.prank(daniel);
        oethVault.requestWithdrawal(4e18);
        vm.prank(josh);
        oethVault.requestWithdrawal(12e18);
        vm.prank(matt);
        oethVault.requestWithdrawal(16e18);

        oethVault.addWithdrawalQueueLiquidity();

        // Mint 17 WETH = exactly covers outstanding 32 - 15 in vault = 17
        _mintOETH(daniel, 17e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        // Should be able to claim all 3 requests
        vm.prank(daniel);
        oethVault.claimWithdrawal(4);
        vm.prank(josh);
        oethVault.claimWithdrawal(5);
        vm.prank(matt);
        oethVault.claimWithdrawal(6);
    }

    function test_mintCoversOutstandingPlusBuffer() public {
        _drainInitialOETH();

        _mintOETH(daniel, 15e18);
        _mintOETH(josh, 20e18);
        _mintOETH(matt, 30e18);
        _mintOETH(domen, 40e18);

        vm.prank(governor);
        oethVault.setMaxSupplyDiff(3e16);

        vm.prank(daniel);
        oethVault.requestWithdrawal(2e18);
        vm.prank(josh);
        oethVault.requestWithdrawal(3e18);
        vm.warp(block.timestamp + DELAY_PERIOD);
        vm.prank(daniel);
        oethVault.claimWithdrawal(2);
        vm.prank(josh);
        oethVault.claimWithdrawal(3);

        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(85e18)));

        vm.prank(governor);
        oethVault.setVaultBuffer(1e16); // 1%

        vm.prank(daniel);
        oethVault.requestWithdrawal(4e18);
        vm.prank(josh);
        oethVault.requestWithdrawal(12e18);
        vm.prank(matt);
        oethVault.requestWithdrawal(16e18);

        oethVault.addWithdrawalQueueLiquidity();

        // Mint 18 WETH = covers outstanding + ~1 WETH vault buffer
        _mintOETH(daniel, 18e18);

        // Should be able to deposit 1 WETH to strategy
        vm.prank(governor);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(1e18)));
    }

    //////////////////////////////////////////////////////
    /// --- FULL DRAIN / EDGE CASES  (~4 TESTS)
    //////////////////////////////////////////////////////

    function test_lastUserRequestsRemainingWETH() public {
        _drainInitialOETH();

        _mintOETH(daniel, 10e18);
        _mintOETH(josh, 20e18);
        _mintOETH(matt, 10e18);

        // Disable solvency check for full drain scenarios
        vm.prank(governor);
        oethVault.setMaxSupplyDiff(0);

        // Request + claim 30 WETH
        vm.prank(daniel);
        oethVault.requestWithdrawal(10e18);
        vm.prank(josh);
        oethVault.requestWithdrawal(20e18);
        vm.warp(block.timestamp + DELAY_PERIOD);
        vm.prank(daniel);
        oethVault.claimWithdrawal(2);
        vm.prank(josh);
        oethVault.claimWithdrawal(3);

        // Matt requests the remaining 10 WETH
        vm.prank(matt);
        oethVault.requestWithdrawal(10e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        oethVault.claimWithdrawal(4);

        assertEq(oethVault.totalValue(), 0, "Total value should be 0 after full drain");
    }

    function test_claimSmallerThanAvailable() public {
        _drainInitialOETH();

        _mintOETH(daniel, 10e18);
        _mintOETH(josh, 20e18);
        _mintOETH(matt, 70e18);

        vm.prank(matt);
        oethVault.requestWithdrawal(40e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint256 joshWethBefore = weth.balanceOf(josh);

        // Josh requests 20 which is smaller than 60 available
        vm.prank(josh);
        oethVault.requestWithdrawal(20e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(josh);
        oethVault.claimWithdrawal(3);

        assertEq(weth.balanceOf(josh) - joshWethBefore, 20e18, "Josh should receive 20 WETH");
    }

    function test_claimExactlyAvailable() public {
        _drainInitialOETH();

        _mintOETH(daniel, 10e18);
        _mintOETH(josh, 20e18);
        _mintOETH(matt, 70e18);

        vm.prank(matt);
        oethVault.requestWithdrawal(40e18);
        vm.warp(block.timestamp + DELAY_PERIOD);
        vm.prank(matt);
        oethVault.claimWithdrawal(2);

        // Transfer all OETH to matt
        vm.prank(josh);
        oeth.transfer(matt, 20e18);
        vm.prank(daniel);
        oeth.transfer(matt, 10e18);

        // Disable solvency check — matt is draining all remaining OETH
        vm.prank(governor);
        oethVault.setMaxSupplyDiff(0);

        // Matt requests remaining 60 OETH
        vm.prank(matt);
        oethVault.requestWithdrawal(60e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(matt);
        oethVault.claimWithdrawal(3);

        assertEq(weth.balanceOf(address(oethVault)), 0, "Vault should be empty");
    }

    function test_claimMoreThanAvailable_reverts() public {
        _drainInitialOETH();

        _mintOETH(daniel, 10e18);
        _mintOETH(josh, 20e18);
        _mintOETH(matt, 70e18);

        vm.prank(matt);
        oethVault.requestWithdrawal(40e18);
        vm.warp(block.timestamp + DELAY_PERIOD);
        vm.prank(matt);
        oethVault.claimWithdrawal(2);

        vm.prank(josh);
        oeth.transfer(matt, 20e18);
        vm.prank(daniel);
        oeth.transfer(matt, 10e18);

        // Disable solvency check — matt is draining all remaining OETH
        vm.prank(governor);
        oethVault.setMaxSupplyDiff(0);

        vm.prank(matt);
        oethVault.requestWithdrawal(60e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        // Simulate vault losing 50 WETH
        vm.prank(address(oethVault));
        weth.transfer(governor, 50e18);

        vm.prank(matt);
        vm.expectRevert("Queue pending liquidity");
        oethVault.claimWithdrawal(3);
    }

    //////////////////////////////////////////////////////
    /// --- INSOLVENCY / SLASH SCENARIOS  (~9 TESTS)
    //////////////////////////////////////////////////////

    function test_insolvency_totalValueZeroAfter2WETHSlash() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        // Slash 2 WETH from strategy
        vm.prank(address(strategy));
        weth.transfer(governor, 2e18);

        // 100 from mints - 99 outstanding - 2 slash = -1 → 0
        assertEq(oethVault.totalValue(), 0, "Total value should be 0");
    }

    function test_insolvency_checkBalanceZeroAfter2WETHSlash() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        vm.prank(address(strategy));
        weth.transfer(governor, 2e18);

        assertEq(oethVault.checkBalance(address(weth)), 0, "Check balance should be 0");
    }

    function test_insolvency_requestRevertsTooManyOutstanding_2WETH() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        vm.prank(address(strategy));
        weth.transfer(governor, 2e18);

        vm.prank(matt);
        vm.expectRevert("Too many outstanding requests");
        oethVault.requestWithdrawal(1e18);
    }

    function test_insolvency_claimRevertsTooManyOutstanding_2WETH() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        vm.prank(address(strategy));
        weth.transfer(governor, 2e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(daniel);
        vm.expectRevert("Too many outstanding requests");
        oethVault.claimWithdrawal(2);
    }

    function test_insolvency_totalValueZeroAfter1WETHSlash() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        vm.prank(address(strategy));
        weth.transfer(governor, 1e18);

        // 100 - 99 - 1 = 0
        assertEq(oethVault.totalValue(), 0, "Total value should be 0 after 1 WETH slash");
    }

    function test_insolvency_requestRevertsTooManyOutstanding_1WETH() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        vm.prank(address(strategy));
        weth.transfer(governor, 1e18);

        vm.prank(matt);
        vm.expectRevert("Too many outstanding requests");
        oethVault.requestWithdrawal(1e18);
    }

    function test_insolvency_smallSlash_totalValueReduced() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        // Slash 0.02 WETH
        vm.prank(address(strategy));
        weth.transfer(governor, 0.02e18);

        // 100 - 99 - 0.02 = 0.98 WETH total value
        assertEq(oethVault.totalValue(), 0.98e18, "Total value should be 0.98");
    }

    function test_insolvency_requestRevertsBackingError_smallSlash() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        vm.prank(address(strategy));
        weth.transfer(governor, 0.02e18);

        // 1 OETH request should fail: supply / totalValue off by > 1%
        vm.prank(matt);
        vm.expectRevert("Too many outstanding requests");
        oethVault.requestWithdrawal(1e18);
    }

    function test_insolvency_smallRequestRevertsBackingError() public {
        MockStrategy strategy = _setupInsolvencyScenario();

        vm.prank(address(strategy));
        weth.transfer(governor, 0.02e18);

        // Tiny request: totalValue = 0.98, supply after = ~0, diff check
        vm.prank(matt);
        vm.expectRevert("Backing supply liquidity error");
        oethVault.requestWithdrawal(0.01e18);
    }

    //////////////////////////////////////////////////////
    /// --- SOLVENCY WITH 3% AND 10% MAXSUPPLYDIFF
    //////////////////////////////////////////////////////

    function test_solvencyAt3Pct_requestReverts() public {
        _setupSlashWith5Percent();

        vm.prank(governor);
        oethVault.setMaxSupplyDiff(3e16);

        vm.prank(matt);
        vm.expectRevert("Backing supply liquidity error");
        oethVault.requestWithdrawal(1e18);
    }

    function test_solvencyAt3Pct_claimReverts() public {
        _setupSlashWith5Percent();

        vm.prank(governor);
        oethVault.setMaxSupplyDiff(3e16);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(daniel);
        vm.expectRevert("Backing supply liquidity error");
        oethVault.claimWithdrawal(2);
    }

    function test_solvencyAt10Pct_requestSucceeds() public {
        _setupSlashWith5Percent();

        vm.prank(governor);
        oethVault.setMaxSupplyDiff(1e17); // 10%

        vm.prank(matt);
        oethVault.requestWithdrawal(1e18);
    }

    function test_solvencyAt10Pct_claimSucceeds() public {
        _setupSlashWith5Percent();

        vm.prank(governor);
        oethVault.setMaxSupplyDiff(1e17); // 10%

        vm.prank(daniel);
        oethVault.claimWithdrawal(2);
    }

    //////////////////////////////////////////////////////
    /// --- FIRST USER CLAIM IN SLASH SCENARIO
    //////////////////////////////////////////////////////

    function test_slashScenario_firstUserCanClaim() public {
        _setupSlashWith5Percent();

        // With no maxSupplyDiff check (set to 0), first user can claim
        vm.prank(daniel);
        oethVault.claimWithdrawal(2);

        assertEq(weth.balanceOf(daniel), 10e18);
    }

    function test_slashScenario_secondUserLacksLiquidity() public {
        _setupSlashWith5Percent();

        vm.prank(josh);
        vm.expectRevert("Queue pending liquidity");
        oethVault.claimWithdrawal(3);
    }

    function test_slashScenario_requestWithSolvencyOff() public {
        _setupSlashWith5Percent();

        vm.prank(matt);
        oethVault.requestWithdrawal(10e18);
        // Should succeed with maxSupplyDiff = 0
    }

    //////////////////////////////////////////////////////
    /// --- REDEEM DOES NOT REBASE
    //////////////////////////////////////////////////////

    /// @dev Rebasing is now operator-gated and no longer auto-triggered on redeem,
    ///      regardless of the request size. Pending yield stays pending.
    function test_requestWithdrawal_doesNotTriggerRebase() public {
        // Simulate yield that a rebase would distribute
        _dealWETH(address(this), 2e18);
        MockERC20(address(weth)).transfer(address(oethVault), 2e18);

        uint256 mattBefore = oeth.balanceOf(matt);

        vm.prank(matt);
        oethVault.requestWithdrawal(50e18);

        // Balance drops by exactly the requested amount — no yield distributed
        assertEq(oeth.balanceOf(matt), mattBefore - 50e18, "Redeem must not trigger a rebase");
    }

    //////////////////////////////////////////////////////
    /// --- CLAIMWITHDRAWAL — CAPITAL PAUSED
    //////////////////////////////////////////////////////

    function test_claimWithdrawal_RevertWhen_capitalPaused() public {
        vm.prank(matt);
        oethVault.requestWithdrawal(50e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(governor);
        oethVault.pauseCapital();

        vm.prank(matt);
        vm.expectRevert("Capital paused");
        oethVault.claimWithdrawal(0);
    }

    function test_claimWithdrawals_RevertWhen_capitalPaused() public {
        vm.prank(matt);
        oethVault.requestWithdrawal(50e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(governor);
        oethVault.pauseCapital();

        uint256[] memory ids = new uint256[](1);
        ids[0] = 0;

        vm.prank(matt);
        vm.expectRevert("Capital paused");
        oethVault.claimWithdrawals(ids);
    }

    //////////////////////////////////////////////////////
    /// --- CLAIMWITHDRAWAL — ASYNC NOT ENABLED
    //////////////////////////////////////////////////////

    function test_claimWithdrawal_RevertWhen_asyncNotEnabled() public {
        // Disable async withdrawals
        vm.prank(governor);
        oethVault.setWithdrawalClaimDelay(0);

        vm.prank(matt);
        vm.expectRevert("Async withdrawals not enabled");
        oethVault.claimWithdrawal(0);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    struct VaultSnapshot {
        uint256 oethTotalSupply;
        uint256 oethTotalValue;
        uint256 vaultCheckBalance;
        uint256 userOeth;
        uint256 userWeth;
        uint256 vaultWeth;
        uint128 queued;
        uint128 claimable;
        uint128 claimed;
        uint128 nextWithdrawalIndex;
    }

    function _snap(address user) internal view returns (VaultSnapshot memory s) {
        s.oethTotalSupply = oeth.totalSupply();
        s.oethTotalValue = oethVault.totalValue();
        s.vaultCheckBalance = oethVault.checkBalance(address(weth));
        s.userOeth = oeth.balanceOf(user);
        s.userWeth = weth.balanceOf(user);
        s.vaultWeth = weth.balanceOf(address(oethVault));
        s.queued = oethVault.withdrawalQueueMetadata().queued;
        s.claimable = oethVault.withdrawalQueueMetadata().claimable;
        s.claimed = oethVault.withdrawalQueueMetadata().claimed;
        s.nextWithdrawalIndex = oethVault.withdrawalQueueMetadata().nextWithdrawalIndex;
    }

    function _toArray(address a) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }

    function _toArray(uint256 a) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](1);
        arr[0] = a;
    }

    /// @dev Drain the initial 200 OETH minted in setUp (matt+josh 100 each)
    function _drainInitialOETH() internal {
        // Disable solvency check during drain (totalValue goes to 0)
        vm.prank(governor);
        oethVault.setMaxSupplyDiff(0);

        vm.prank(josh);
        oethVault.requestWithdrawal(100e18);
        vm.prank(matt);
        oethVault.requestWithdrawal(100e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        vm.prank(josh);
        oethVault.claimWithdrawal(0);
        vm.prank(matt);
        oethVault.claimWithdrawal(1);

        // Restore default solvency check
        vm.prank(governor);
        oethVault.setMaxSupplyDiff(5e16);
    }

    /// @dev Fund daniel(10), josh(20), matt(30) with WETH and mint OETH. Set maxSupplyDiff to 3%.
    function _setupThreeUsersWithOETH() internal {
        _drainInitialOETH();

        _mintOETH(daniel, 10e18);
        _mintOETH(josh, 20e18);
        _mintOETH(matt, 30e18);

        vm.prank(governor);
        oethVault.setMaxSupplyDiff(3e16); // 3%
    }

    /// @dev Deploy+approve strategy, deposit 15 WETH to it. Also request 5+18=23 OETH withdrawals.
    function _setupStrategyWith15WETH() internal returns (MockStrategy strategy) {
        _setupThreeUsersWithOETH();

        strategy = _deployAndApproveStrategy();

        // Deposit 15 WETH to strategy (leaves 45 WETH in vault)
        vm.prank(governor);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(15e18)));

        // Request 5 + 18 = 23 OETH withdrawal (leaves 22 WETH unallocated)
        vm.prank(daniel);
        oethVault.requestWithdrawal(5e18);
        vm.prank(josh);
        oethVault.requestWithdrawal(18e18);
    }

    function _setupInsolvencyScenario() internal returns (MockStrategy strategy) {
        _drainInitialOETH();

        _mintOETH(daniel, 20e18);
        _mintOETH(josh, 30e18);
        _mintOETH(matt, 50e18);

        strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.setDefaultStrategy(address(strategy));

        vm.prank(governor);
        oethVault.allocate(); // Send 100 WETH to strategy

        // Request 99 WETH withdrawal
        vm.prank(daniel);
        oethVault.requestWithdrawal(20e18);
        vm.prank(josh);
        oethVault.requestWithdrawal(30e18);
        vm.prank(matt);
        oethVault.requestWithdrawal(49e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        // Withdraw 40 WETH from strategy to vault
        vm.prank(strategist);
        oethVault.withdrawFromStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(40e18)));

        oethVault.addWithdrawalQueueLiquidity();

        vm.prank(governor);
        oethVault.setMaxSupplyDiff(1e16); // 1%
    }

    function _setupSlashWith5Percent() internal returns (MockStrategy strategy) {
        _drainInitialOETH();

        _mintOETH(daniel, 10e18);
        _mintOETH(josh, 20e18);
        _mintOETH(matt, 30e18);

        strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.setDefaultStrategy(address(strategy));

        vm.prank(governor);
        oethVault.allocate();

        // Request 40 WETH withdrawal
        vm.prank(daniel);
        oethVault.requestWithdrawal(10e18);
        vm.prank(josh);
        oethVault.requestWithdrawal(20e18);
        vm.prank(matt);
        oethVault.requestWithdrawal(10e18);

        vm.warp(block.timestamp + DELAY_PERIOD);

        // Slash 1 WETH
        vm.prank(address(strategy));
        weth.transfer(governor, 1e18);

        // Withdraw 15 WETH to vault
        vm.prank(strategist);
        oethVault.withdrawFromStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(15e18)));

        oethVault.addWithdrawalQueueLiquidity();

        // Initially maxSupplyDiff is 5% (set in setUp), turn it off for base state
        vm.prank(governor);
        oethVault.setMaxSupplyDiff(0);
    }
}
