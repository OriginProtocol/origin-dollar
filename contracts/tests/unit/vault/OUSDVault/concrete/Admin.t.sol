// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Shared_Test} from "tests/unit/vault/OUSDVault/shared/Shared.t.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {IVault} from "contracts/interfaces/IVault.sol";

contract Unit_Concrete_OUSDVault_Admin_Test is Unit_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- CAPITAL PAUSING
    //////////////////////////////////////////////////////

    function test_capitalPaused_defaultIsFalse() public view {
        assertFalse(ousdVault.capitalPaused(), "Capital should not be paused");
    }

    function test_pauseCapital_governor() public {
        vm.prank(governor);
        ousdVault.pauseCapital();
        assertTrue(ousdVault.capitalPaused());
    }

    function test_pauseCapital_strategist() public {
        vm.prank(strategist);
        ousdVault.pauseCapital();
        assertTrue(ousdVault.capitalPaused());
    }

    function test_pauseCapital_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.CapitalPaused();
        ousdVault.pauseCapital();
    }

    function test_pauseCapital_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        ousdVault.pauseCapital();
    }

    function test_unpauseCapital_governor() public {
        vm.prank(governor);
        ousdVault.pauseCapital();

        vm.prank(governor);
        ousdVault.unpauseCapital();
        assertFalse(ousdVault.capitalPaused());
    }

    function test_unpauseCapital_strategist() public {
        vm.prank(governor);
        ousdVault.pauseCapital();

        vm.prank(strategist);
        ousdVault.unpauseCapital();
        assertFalse(ousdVault.capitalPaused());
    }

    function test_unpauseCapital_emitsEvent() public {
        vm.prank(governor);
        ousdVault.pauseCapital();

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.CapitalUnpaused();
        ousdVault.unpauseCapital();
    }

    function test_unpauseCapital_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        ousdVault.unpauseCapital();
    }

    function test_pauseCapital_stopsMint() public {
        vm.prank(governor);
        ousdVault.pauseCapital();

        _dealUSDC(alice, 50e6);
        vm.startPrank(alice);
        usdc.approve(address(ousdVault), 50e6);
        vm.expectRevert("Capital paused");
        ousdVault.mint(50e6);
        vm.stopPrank();
    }

    function test_unpauseCapital_allowsMint() public {
        vm.prank(governor);
        ousdVault.pauseCapital();
        vm.prank(governor);
        ousdVault.unpauseCapital();

        _dealUSDC(alice, 50e6);
        vm.startPrank(alice);
        usdc.approve(address(ousdVault), 50e6);
        ousdVault.mint(50e6);
        vm.stopPrank();

        assertEq(ousd.balanceOf(alice), 50e18);
    }

    //////////////////////////////////////////////////////
    /// --- REBASE PAUSING
    //////////////////////////////////////////////////////

    function test_rebasePaused_defaultIsFalse() public view {
        assertFalse(ousdVault.rebasePaused(), "Rebase should not be paused");
    }

    function test_pauseRebase_governor() public {
        vm.prank(governor);
        ousdVault.pauseRebase();
        assertTrue(ousdVault.rebasePaused());
    }

    function test_pauseRebase_strategist() public {
        vm.prank(strategist);
        ousdVault.pauseRebase();
        assertTrue(ousdVault.rebasePaused());
    }

    function test_pauseRebase_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.RebasePaused();
        ousdVault.pauseRebase();
    }

    function test_pauseRebase_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        ousdVault.pauseRebase();
    }

    function test_unpauseRebase_governor() public {
        vm.prank(governor);
        ousdVault.pauseRebase();

        vm.prank(governor);
        ousdVault.unpauseRebase();
        assertFalse(ousdVault.rebasePaused());
    }

    function test_unpauseRebase_strategist() public {
        vm.prank(governor);
        ousdVault.pauseRebase();

        vm.prank(strategist);
        ousdVault.unpauseRebase();
        assertFalse(ousdVault.rebasePaused());
    }

    function test_unpauseRebase_emitsEvent() public {
        vm.prank(governor);
        ousdVault.pauseRebase();

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.RebaseUnpaused();
        ousdVault.unpauseRebase();
    }

    function test_unpauseRebase_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        ousdVault.unpauseRebase();
    }

    //////////////////////////////////////////////////////
    /// --- SETVAULTBUFFER
    //////////////////////////////////////////////////////

    function test_setVaultBuffer_governor() public {
        vm.prank(governor);
        ousdVault.setVaultBuffer(5e17); // 50%
        assertEq(ousdVault.vaultBuffer(), 5e17);
    }

    function test_setVaultBuffer_strategist() public {
        vm.prank(strategist);
        ousdVault.setVaultBuffer(2e17); // 20%
        assertEq(ousdVault.vaultBuffer(), 2e17);
    }

    function test_setVaultBuffer_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.VaultBufferUpdated(5e17);
        ousdVault.setVaultBuffer(5e17);
    }

    function test_setVaultBuffer_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        ousdVault.setVaultBuffer(5e17);
    }

    function test_setVaultBuffer_RevertWhen_exceedsMax() public {
        vm.prank(governor);
        vm.expectRevert("Invalid value");
        ousdVault.setVaultBuffer(1e18 + 1);
    }

    function test_setVaultBuffer_maxValue() public {
        vm.prank(governor);
        ousdVault.setVaultBuffer(1e18); // 100%
        assertEq(ousdVault.vaultBuffer(), 1e18);
    }

    //////////////////////////////////////////////////////
    /// --- SETAUTOALLOCATETHRESHOLD
    //////////////////////////////////////////////////////

    function test_setAutoAllocateThreshold_governor() public {
        vm.prank(governor);
        ousdVault.setAutoAllocateThreshold(5000e18);
        assertEq(ousdVault.autoAllocateThreshold(), 5000e18);
    }

    function test_setAutoAllocateThreshold_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.AllocateThresholdUpdated(5000e18);
        ousdVault.setAutoAllocateThreshold(5000e18);
    }

    function test_setAutoAllocateThreshold_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.setAutoAllocateThreshold(5000e18);
    }

    function test_setAutoAllocateThreshold_RevertWhen_strategist() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.setAutoAllocateThreshold(5000e18);
    }

    //////////////////////////////////////////////////////
    /// --- SETREBASETHRESHOLD
    //////////////////////////////////////////////////////

    function test_setRebaseThreshold_governor() public {
        vm.prank(governor);
        ousdVault.setRebaseThreshold(500e18);
        assertEq(ousdVault.rebaseThreshold(), 500e18);
    }

    function test_setRebaseThreshold_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.RebaseThresholdUpdated(500e18);
        ousdVault.setRebaseThreshold(500e18);
    }

    function test_setRebaseThreshold_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.setRebaseThreshold(500e18);
    }

    //////////////////////////////////////////////////////
    /// --- SETSTRATEGISTADDR
    //////////////////////////////////////////////////////

    function test_setStrategistAddr_governor() public {
        vm.prank(governor);
        ousdVault.setStrategistAddr(alice);
        assertEq(ousdVault.strategistAddr(), alice);
    }

    function test_setStrategistAddr_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.StrategistUpdated(alice);
        ousdVault.setStrategistAddr(alice);
    }

    function test_setStrategistAddr_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.setStrategistAddr(alice);
    }

    //////////////////////////////////////////////////////
    /// --- SETDEFAULTSTRATEGY
    //////////////////////////////////////////////////////

    function test_setDefaultStrategy_governor() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        ousdVault.setDefaultStrategy(address(strategy));
        assertEq(ousdVault.defaultStrategy(), address(strategy));
    }

    function test_setDefaultStrategy_strategist() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(strategist);
        ousdVault.setDefaultStrategy(address(strategy));
        assertEq(ousdVault.defaultStrategy(), address(strategy));
    }

    function test_setDefaultStrategy_emitsEvent() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.DefaultStrategyUpdated(address(strategy));
        ousdVault.setDefaultStrategy(address(strategy));
    }

    function test_setDefaultStrategy_zeroAddressRemoves() public {
        MockStrategy strategy = _deployAndApproveStrategy();
        vm.prank(governor);
        ousdVault.setDefaultStrategy(address(strategy));

        vm.prank(governor);
        ousdVault.setDefaultStrategy(address(0));
        assertEq(ousdVault.defaultStrategy(), address(0));
    }

    function test_setDefaultStrategy_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        ousdVault.setDefaultStrategy(address(0));
    }

    function test_setDefaultStrategy_RevertWhen_notApproved() public {
        MockStrategy fakeStrategy = new MockStrategy();

        vm.prank(governor);
        vm.expectRevert("Strategy not approved");
        ousdVault.setDefaultStrategy(address(fakeStrategy));
    }

    //////////////////////////////////////////////////////
    /// --- SETWITHDRAWALCLAIMDELAY
    //////////////////////////////////////////////////////

    function test_setWithdrawalClaimDelay_governor() public {
        vm.prank(governor);
        ousdVault.setWithdrawalClaimDelay(1200);
        assertEq(ousdVault.withdrawalClaimDelay(), 1200);
    }

    function test_setWithdrawalClaimDelay_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.WithdrawalClaimDelayUpdated(1200);
        ousdVault.setWithdrawalClaimDelay(1200);
    }

    function test_setWithdrawalClaimDelay_zeroDisables() public {
        vm.prank(governor);
        ousdVault.setWithdrawalClaimDelay(0);
        assertEq(ousdVault.withdrawalClaimDelay(), 0);
    }

    function test_setWithdrawalClaimDelay_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.setWithdrawalClaimDelay(600);
    }

    function test_setWithdrawalClaimDelay_RevertWhen_tooShort() public {
        vm.prank(governor);
        vm.expectRevert("Invalid claim delay period");
        ousdVault.setWithdrawalClaimDelay(599); // < 10 minutes
    }

    function test_setWithdrawalClaimDelay_RevertWhen_tooLong() public {
        vm.prank(governor);
        vm.expectRevert("Invalid claim delay period");
        ousdVault.setWithdrawalClaimDelay(15 days + 1);
    }

    function test_setWithdrawalClaimDelay_minValid() public {
        vm.prank(governor);
        ousdVault.setWithdrawalClaimDelay(10 minutes);
        assertEq(ousdVault.withdrawalClaimDelay(), 10 minutes);
    }

    function test_setWithdrawalClaimDelay_maxValid() public {
        vm.prank(governor);
        ousdVault.setWithdrawalClaimDelay(15 days);
        assertEq(ousdVault.withdrawalClaimDelay(), 15 days);
    }

    //////////////////////////////////////////////////////
    /// --- SETREBASERATEMAX
    //////////////////////////////////////////////////////

    function test_setRebaseRateMax_governor() public {
        vm.prank(governor);
        ousdVault.setRebaseRateMax(100e18); // 100% APR
    }

    function test_setRebaseRateMax_strategist() public {
        vm.prank(strategist);
        ousdVault.setRebaseRateMax(100e18);
    }

    function test_setRebaseRateMax_emitsEvent() public {
        uint256 apr = 100e18;
        uint256 expectedPerSecond = apr / 100 / 365 days;

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.RebasePerSecondMaxChanged(expectedPerSecond);
        ousdVault.setRebaseRateMax(apr);
    }

    function test_setRebaseRateMax_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        ousdVault.setRebaseRateMax(100e18);
    }

    function test_setRebaseRateMax_RevertWhen_tooHigh() public {
        // MAX_REBASE_PER_SECOND = 0.05 ether / 1 days
        // So max APR ≈ (5e16/86400) * 100 * 365 days => huge number
        // Rate too high would be > MAX_REBASE_PER_SECOND * 100 * 365 days
        vm.prank(governor);
        vm.expectRevert("Rate too high");
        ousdVault.setRebaseRateMax(type(uint256).max);
    }

    //////////////////////////////////////////////////////
    /// --- SETDRIPDURATION
    //////////////////////////////////////////////////////

    function test_setDripDuration_governor() public {
        vm.prank(governor);
        ousdVault.setDripDuration(86400); // 1 day
        assertEq(ousdVault.dripDuration(), 86400);
    }

    function test_setDripDuration_strategist() public {
        vm.prank(strategist);
        ousdVault.setDripDuration(86400);
        assertEq(ousdVault.dripDuration(), 86400);
    }

    function test_setDripDuration_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.DripDurationChanged(86400);
        ousdVault.setDripDuration(86400);
    }

    function test_setDripDuration_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        ousdVault.setDripDuration(86400);
    }

    //////////////////////////////////////////////////////
    /// --- SETMAXSUPPLYDIFF
    //////////////////////////////////////////////////////

    function test_setMaxSupplyDiff_governor() public {
        vm.prank(governor);
        ousdVault.setMaxSupplyDiff(1e16); // 1%
        assertEq(ousdVault.maxSupplyDiff(), 1e16);
    }

    function test_setMaxSupplyDiff_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.MaxSupplyDiffChanged(1e16);
        ousdVault.setMaxSupplyDiff(1e16);
    }

    function test_setMaxSupplyDiff_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.setMaxSupplyDiff(1e16);
    }

    //////////////////////////////////////////////////////
    /// --- SETTRUSTEEADDRESS
    //////////////////////////////////////////////////////

    function test_setTrusteeAddress_governor() public {
        vm.prank(governor);
        ousdVault.setTrusteeAddress(alice);
        assertEq(ousdVault.trusteeAddress(), alice);
    }

    function test_setTrusteeAddress_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.TrusteeAddressChanged(alice);
        ousdVault.setTrusteeAddress(alice);
    }

    function test_setTrusteeAddress_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.setTrusteeAddress(alice);
    }

    function test_setTrusteeAddress_zeroDisables() public {
        vm.prank(governor);
        ousdVault.setTrusteeAddress(alice);

        vm.prank(governor);
        ousdVault.setTrusteeAddress(address(0));
        assertEq(ousdVault.trusteeAddress(), address(0));
    }

    //////////////////////////////////////////////////////
    /// --- SETTRUSTEEFEEBPS
    //////////////////////////////////////////////////////

    function test_setTrusteeFeeBps_governor() public {
        vm.prank(governor);
        ousdVault.setTrusteeFeeBps(2000);
        assertEq(ousdVault.trusteeFeeBps(), 2000);
    }

    function test_setTrusteeFeeBps_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.TrusteeFeeBpsChanged(2000);
        ousdVault.setTrusteeFeeBps(2000);
    }

    function test_setTrusteeFeeBps_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.setTrusteeFeeBps(2000);
    }

    function test_setTrusteeFeeBps_RevertWhen_exceedsMax() public {
        vm.prank(governor);
        vm.expectRevert("basis cannot exceed 50%");
        ousdVault.setTrusteeFeeBps(5001);
    }

    function test_setTrusteeFeeBps_maxValue() public {
        vm.prank(governor);
        ousdVault.setTrusteeFeeBps(5000); // 50%
        assertEq(ousdVault.trusteeFeeBps(), 5000);
    }

    //////////////////////////////////////////////////////
    /// --- APPROVESTRATEGY
    //////////////////////////////////////////////////////

    function test_approveStrategy_governor() public {
        MockStrategy strategy = new MockStrategy();

        vm.prank(governor);
        ousdVault.approveStrategy(address(strategy));

        assertTrue(ousdVault.strategies(address(strategy)).isSupported);
    }

    function test_approveStrategy_emitsEvent() public {
        MockStrategy strategy = new MockStrategy();

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.StrategyApproved(address(strategy));
        ousdVault.approveStrategy(address(strategy));
    }

    function test_approveStrategy_addsToList() public {
        MockStrategy strategy = new MockStrategy();

        vm.prank(governor);
        ousdVault.approveStrategy(address(strategy));

        address[] memory strats = ousdVault.getAllStrategies();
        assertEq(strats.length, 1);
        assertEq(strats[0], address(strategy));
    }

    function test_approveStrategy_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.approveStrategy(alice);
    }

    function test_approveStrategy_RevertWhen_alreadyApproved() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        vm.expectRevert("Strategy already approved");
        ousdVault.approveStrategy(address(strategy));
    }

    function test_approveStrategy_RevertWhen_assetNotSupported() public {
        MockStrategy strategy = new MockStrategy();
        strategy.setShouldSupportAsset(false);

        vm.prank(governor);
        vm.expectRevert("Asset not supported by Strategy");
        ousdVault.approveStrategy(address(strategy));
    }

    //////////////////////////////////////////////////////
    /// --- REMOVESTRATEGY
    //////////////////////////////////////////////////////

    function test_removeStrategy_governor() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        ousdVault.removeStrategy(address(strategy));

        assertFalse(ousdVault.strategies(address(strategy)).isSupported);
        assertEq(ousdVault.getStrategyCount(), 0);
    }

    function test_removeStrategy_emitsEvent() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.StrategyRemoved(address(strategy));
        ousdVault.removeStrategy(address(strategy));
    }

    function test_removeStrategy_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.removeStrategy(alice);
    }

    function test_removeStrategy_RevertWhen_notApproved() public {
        vm.prank(governor);
        vm.expectRevert("Strategy not approved");
        ousdVault.removeStrategy(alice);
    }

    function test_removeStrategy_RevertWhen_isDefault() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        ousdVault.setDefaultStrategy(address(strategy));

        vm.expectRevert("Strategy is default for asset");
        ousdVault.removeStrategy(address(strategy));
        vm.stopPrank();
    }

    function test_removeStrategy_clearsMintWhitelist() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        ousdVault.addStrategyToMintWhitelist(address(strategy));
        assertTrue(ousdVault.isMintWhitelistedStrategy(address(strategy)));

        ousdVault.removeStrategy(address(strategy));
        assertFalse(ousdVault.isMintWhitelistedStrategy(address(strategy)));
        vm.stopPrank();
    }

    //////////////////////////////////////////////////////
    /// --- ADDSTRATEGYTOMINTWHITELIST
    //////////////////////////////////////////////////////

    function test_addStrategyToMintWhitelist_governor() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        ousdVault.addStrategyToMintWhitelist(address(strategy));

        assertTrue(ousdVault.isMintWhitelistedStrategy(address(strategy)));
    }

    function test_addStrategyToMintWhitelist_emitsEvent() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.StrategyAddedToMintWhitelist(address(strategy));
        ousdVault.addStrategyToMintWhitelist(address(strategy));
    }

    function test_addStrategyToMintWhitelist_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.addStrategyToMintWhitelist(alice);
    }

    function test_addStrategyToMintWhitelist_RevertWhen_notApproved() public {
        vm.prank(governor);
        vm.expectRevert("Strategy not approved");
        ousdVault.addStrategyToMintWhitelist(alice);
    }

    function test_addStrategyToMintWhitelist_RevertWhen_alreadyWhitelisted() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        ousdVault.addStrategyToMintWhitelist(address(strategy));
        vm.expectRevert("Already whitelisted");
        ousdVault.addStrategyToMintWhitelist(address(strategy));
        vm.stopPrank();
    }

    //////////////////////////////////////////////////////
    /// --- REMOVESTRATEGYFROMMINTWHITELIST
    //////////////////////////////////////////////////////

    function test_removeStrategyFromMintWhitelist_governor() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        ousdVault.addStrategyToMintWhitelist(address(strategy));
        ousdVault.removeStrategyFromMintWhitelist(address(strategy));
        vm.stopPrank();

        assertFalse(ousdVault.isMintWhitelistedStrategy(address(strategy)));
    }

    function test_removeStrategyFromMintWhitelist_emitsEvent() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        ousdVault.addStrategyToMintWhitelist(address(strategy));

        vm.expectEmit(true, true, true, true);
        emit IVault.StrategyRemovedFromMintWhitelist(address(strategy));
        ousdVault.removeStrategyFromMintWhitelist(address(strategy));
        vm.stopPrank();
    }

    function test_removeStrategyFromMintWhitelist_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.removeStrategyFromMintWhitelist(alice);
    }

    function test_removeStrategyFromMintWhitelist_RevertWhen_notWhitelisted() public {
        vm.prank(governor);
        vm.expectRevert("Not whitelisted");
        ousdVault.removeStrategyFromMintWhitelist(alice);
    }

    //////////////////////////////////////////////////////
    /// --- TRANSFERTOKEN
    //////////////////////////////////////////////////////

    function test_transferToken_governor() public {
        // Create a random ERC20 and send some to the vault
        MockERC20 randomToken = new MockERC20("Random", "RND", 18);
        randomToken.mint(address(ousdVault), 100e18);

        vm.prank(governor);
        ousdVault.transferToken(address(randomToken), 50e18);

        assertEq(randomToken.balanceOf(governor), 50e18, "Governor should receive tokens");
        assertEq(randomToken.balanceOf(address(ousdVault)), 50e18, "Vault should retain remainder");
    }

    function test_transferToken_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        ousdVault.transferToken(address(usdc), 1);
    }

    function test_transferToken_RevertWhen_baseAsset() public {
        vm.prank(governor);
        vm.expectRevert("Only unsupported asset");
        ousdVault.transferToken(address(usdc), 1);
    }

    //////////////////////////////////////////////////////
    /// --- SETDEFAULTSTRATEGY — "ASSET NOT SUPPORTED BY STRATEGY"
    //////////////////////////////////////////////////////

    function test_setDefaultStrategy_RevertWhen_assetNotSupported() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        // Make strategy report that it doesn't support the asset
        strategy.setShouldSupportAsset(false);

        vm.prank(governor);
        vm.expectRevert("Asset not supported by Strategy");
        ousdVault.setDefaultStrategy(address(strategy));
    }

    //////////////////////////////////////////////////////
    /// --- REMOVESTRATEGY — "STRATEGY HAS FUNDS"
    //////////////////////////////////////////////////////

    function test_removeStrategy_RevertWhen_strategyHasFunds() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        // Make checkBalance report a large amount even after withdrawAll
        strategy.setNextBalance(1e18);

        vm.prank(governor);
        vm.expectRevert("Strategy has funds");
        ousdVault.removeStrategy(address(strategy));
    }

    //////////////////////////////////////////////////////
    /// --- _WITHDRAWFROMSTRATEGY — "PARAMETER LENGTH MISMATCH"
    //////////////////////////////////////////////////////

    function test_withdrawFromStrategy_RevertWhen_parameterLengthMismatch() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        address[] memory assets = new address[](2);
        assets[0] = address(usdc);
        assets[1] = address(usdc);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 50e6;

        vm.prank(governor);
        vm.expectRevert("Parameter length mismatch");
        ousdVault.withdrawFromStrategy(address(strategy), assets, amounts);
    }
}
