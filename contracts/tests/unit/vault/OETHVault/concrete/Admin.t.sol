// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OETHVault_Shared_Test} from "tests/unit/vault/OETHVault/shared/Shared.t.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

contract Unit_Concrete_OETHVault_Admin_Test is Unit_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- SETVAULTBUFFER
    //////////////////////////////////////////////////////

    function test_setVaultBuffer_works() public {
        vm.prank(governor);
        oethVault.setVaultBuffer(5e17); // 50%
        assertEq(oethVault.vaultBuffer(), 5e17);
    }

    function test_setVaultBuffer_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.VaultBufferUpdated(5e17);
        oethVault.setVaultBuffer(5e17);
    }

    function test_setVaultBuffer_byStrategist() public {
        vm.prank(strategist);
        oethVault.setVaultBuffer(1e17);
        assertEq(oethVault.vaultBuffer(), 1e17);
    }

    function test_setVaultBuffer_RevertWhen_invalidValue() public {
        vm.prank(governor);
        vm.expectRevert("Invalid value");
        oethVault.setVaultBuffer(1e18 + 1);
    }

    function test_setVaultBuffer_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        oethVault.setVaultBuffer(5e17);
    }

    //////////////////////////////////////////////////////
    /// --- SETAUTOALLOCATETHRESHOLD
    //////////////////////////////////////////////////////

    function test_setAutoAllocateThreshold_works() public {
        vm.prank(governor);
        oethVault.setAutoAllocateThreshold(100e18);
        assertEq(oethVault.autoAllocateThreshold(), 100e18);
    }

    function test_setAutoAllocateThreshold_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.AllocateThresholdUpdated(100e18);
        oethVault.setAutoAllocateThreshold(100e18);
    }

    function test_setAutoAllocateThreshold_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        oethVault.setAutoAllocateThreshold(100e18);
    }

    //////////////////////////////////////////////////////
    /// --- SETREBASETHRESHOLD
    //////////////////////////////////////////////////////

    function test_setRebaseThreshold_works() public {
        vm.prank(governor);
        oethVault.setRebaseThreshold(500e18);
        assertEq(oethVault.rebaseThreshold(), 500e18);
    }

    function test_setRebaseThreshold_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.RebaseThresholdUpdated(500e18);
        oethVault.setRebaseThreshold(500e18);
    }

    function test_setRebaseThreshold_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        oethVault.setRebaseThreshold(500e18);
    }

    //////////////////////////////////////////////////////
    /// --- SETDEFAULTSTRATEGY
    //////////////////////////////////////////////////////

    function test_setDefaultStrategy_works() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.setDefaultStrategy(address(strategy));
        assertEq(oethVault.defaultStrategy(), address(strategy));
    }

    function test_setDefaultStrategy_toZero() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        oethVault.setDefaultStrategy(address(strategy));
        oethVault.setDefaultStrategy(address(0));
        vm.stopPrank();

        assertEq(oethVault.defaultStrategy(), address(0));
    }

    function test_setDefaultStrategy_emitsEvent() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.DefaultStrategyUpdated(address(strategy));
        oethVault.setDefaultStrategy(address(strategy));
    }

    function test_setDefaultStrategy_byStrategist() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(strategist);
        oethVault.setDefaultStrategy(address(strategy));
        assertEq(oethVault.defaultStrategy(), address(strategy));
    }

    function test_setDefaultStrategy_RevertWhen_notApproved() public {
        MockStrategy strategy = new MockStrategy();

        vm.prank(governor);
        vm.expectRevert("Strategy not approved");
        oethVault.setDefaultStrategy(address(strategy));
    }

    function test_setDefaultStrategy_RevertWhen_assetNotSupported() public {
        MockStrategy strategy = new MockStrategy();
        strategy.setShouldSupportAsset(false);

        // Approve it first (need to support asset for approval)
        strategy.setShouldSupportAsset(true);
        vm.prank(governor);
        oethVault.approveStrategy(address(strategy));

        // Now make it not support asset
        strategy.setShouldSupportAsset(false);

        vm.prank(governor);
        vm.expectRevert("Asset not supported by Strategy");
        oethVault.setDefaultStrategy(address(strategy));
    }

    function test_setDefaultStrategy_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        oethVault.setDefaultStrategy(address(0));
    }

    //////////////////////////////////////////////////////
    /// --- SETWITHDRAWALCLAIMDELAY
    //////////////////////////////////////////////////////

    function test_setWithdrawalClaimDelay_works() public {
        vm.prank(governor);
        oethVault.setWithdrawalClaimDelay(1 hours);
        assertEq(oethVault.withdrawalClaimDelay(), 1 hours);
    }

    function test_setWithdrawalClaimDelay_toZero() public {
        vm.prank(governor);
        oethVault.setWithdrawalClaimDelay(0);
        assertEq(oethVault.withdrawalClaimDelay(), 0);
    }

    function test_setWithdrawalClaimDelay_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.WithdrawalClaimDelayUpdated(1 hours);
        oethVault.setWithdrawalClaimDelay(1 hours);
    }

    function test_setWithdrawalClaimDelay_RevertWhen_tooShort() public {
        vm.prank(governor);
        vm.expectRevert("Invalid claim delay period");
        oethVault.setWithdrawalClaimDelay(5 minutes); // < 10 minutes
    }

    function test_setWithdrawalClaimDelay_RevertWhen_tooLong() public {
        vm.prank(governor);
        vm.expectRevert("Invalid claim delay period");
        oethVault.setWithdrawalClaimDelay(16 days); // > 15 days
    }

    function test_setWithdrawalClaimDelay_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        oethVault.setWithdrawalClaimDelay(1 hours);
    }

    //////////////////////////////////////////////////////
    /// --- SETREBASERATEMAX
    //////////////////////////////////////////////////////

    function test_setRebaseRateMax_works() public {
        vm.prank(governor);
        oethVault.setRebaseRateMax(100e18); // 100% APR
        // rebasePerSecondMax = 100e18 / 100 / 365 days
        uint256 expected = uint256(100e18) / 100 / 365 days;
        assertEq(oethVault.rebasePerSecondMax(), expected);
    }

    function test_setRebaseRateMax_emitsEvent() public {
        uint256 expectedPerSecond = uint256(100e18) / 100 / 365 days;
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.RebasePerSecondMaxChanged(expectedPerSecond);
        oethVault.setRebaseRateMax(100e18);
    }

    function test_setRebaseRateMax_byStrategist() public {
        vm.prank(strategist);
        oethVault.setRebaseRateMax(50e18);
        uint256 expected = uint256(50e18) / 100 / 365 days;
        assertEq(oethVault.rebasePerSecondMax(), expected);
    }

    function test_setRebaseRateMax_RevertWhen_rateTooHigh() public {
        // MAX_REBASE_PER_SECOND = 0.05 ether / 1 days
        // To exceed: apr / 100 / 365 days > 0.05 ether / 1 days
        // apr > 0.05 ether * 100 * 365 = 1825 ether
        vm.prank(governor);
        vm.expectRevert("Rate too high");
        oethVault.setRebaseRateMax(2000e18); // 2000% APR — too high
    }

    function test_setRebaseRateMax_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        oethVault.setRebaseRateMax(100e18);
    }

    //////////////////////////////////////////////////////
    /// --- SETDRIPDURATION
    //////////////////////////////////////////////////////

    function test_setDripDuration_works() public {
        vm.prank(governor);
        oethVault.setDripDuration(7 days);
        assertEq(oethVault.dripDuration(), 7 days);
    }

    function test_setDripDuration_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.DripDurationChanged(7 days);
        oethVault.setDripDuration(7 days);
    }

    function test_setDripDuration_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        oethVault.setDripDuration(7 days);
    }

    //////////////////////////////////////////////////////
    /// --- SETMAXSUPPLYDIFF
    //////////////////////////////////////////////////////

    function test_setMaxSupplyDiff_works() public {
        vm.prank(governor);
        oethVault.setMaxSupplyDiff(1e16);
        assertEq(oethVault.maxSupplyDiff(), 1e16);
    }

    function test_setMaxSupplyDiff_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.MaxSupplyDiffChanged(1e16);
        oethVault.setMaxSupplyDiff(1e16);
    }

    function test_setMaxSupplyDiff_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        oethVault.setMaxSupplyDiff(1e16);
    }

    //////////////////////////////////////////////////////
    /// --- SETTRUSTEEADDRESS
    //////////////////////////////////////////////////////

    function test_setTrusteeAddress_works() public {
        vm.prank(governor);
        oethVault.setTrusteeAddress(alice);
        assertEq(oethVault.trusteeAddress(), alice);
    }

    function test_setTrusteeAddress_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.TrusteeAddressChanged(alice);
        oethVault.setTrusteeAddress(alice);
    }

    function test_setTrusteeAddress_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        oethVault.setTrusteeAddress(alice);
    }

    //////////////////////////////////////////////////////
    /// --- SETTRUSTEEFEE
    //////////////////////////////////////////////////////

    function test_setTrusteeFeeBps_works() public {
        vm.prank(governor);
        oethVault.setTrusteeFeeBps(2000);
        assertEq(oethVault.trusteeFeeBps(), 2000);
    }

    function test_setTrusteeFeeBps_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.TrusteeFeeBpsChanged(2000);
        oethVault.setTrusteeFeeBps(2000);
    }

    function test_setTrusteeFeeBps_RevertWhen_tooHigh() public {
        vm.prank(governor);
        vm.expectRevert("basis cannot exceed 50%");
        oethVault.setTrusteeFeeBps(5001);
    }

    function test_setTrusteeFeeBps_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        oethVault.setTrusteeFeeBps(2000);
    }

    //////////////////////////////////////////////////////
    /// --- PAUSE / UNPAUSE REBASE
    //////////////////////////////////////////////////////

    function test_pauseRebase_works() public {
        vm.prank(governor);
        oethVault.pauseRebase();
        assertTrue(oethVault.rebasePaused());
    }

    function test_pauseRebase_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.RebasePaused();
        oethVault.pauseRebase();
    }

    function test_pauseRebase_byStrategist() public {
        vm.prank(strategist);
        oethVault.pauseRebase();
        assertTrue(oethVault.rebasePaused());
    }

    function test_pauseRebase_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        oethVault.pauseRebase();
    }

    function test_unpauseRebase_works() public {
        vm.prank(governor);
        oethVault.pauseRebase();

        vm.prank(governor);
        oethVault.unpauseRebase();
        assertFalse(oethVault.rebasePaused());
    }

    function test_unpauseRebase_emitsEvent() public {
        vm.prank(governor);
        oethVault.pauseRebase();

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.RebaseUnpaused();
        oethVault.unpauseRebase();
    }

    //////////////////////////////////////////////////////
    /// --- PAUSE / UNPAUSE CAPITAL
    //////////////////////////////////////////////////////

    function test_pauseCapital_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.CapitalPaused();
        oethVault.pauseCapital();
    }

    function test_unpauseCapital_emitsEvent() public {
        vm.prank(governor);
        oethVault.pauseCapital();

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.CapitalUnpaused();
        oethVault.unpauseCapital();
    }

    function test_pauseCapital_byStrategist() public {
        vm.prank(strategist);
        oethVault.pauseCapital();
        assertTrue(oethVault.capitalPaused());
    }

    //////////////////////////////////////////////////////
    /// --- TRANSFERTOKEN
    //////////////////////////////////////////////////////

    function test_transferToken_works() public {
        // Create a random ERC20 and send it to the vault
        MockERC20 randomToken = new MockERC20("Random", "RND", 18);
        randomToken.mint(address(oethVault), 100e18);

        vm.prank(governor);
        oethVault.transferToken(address(randomToken), 100e18);

        assertEq(randomToken.balanceOf(governor), 100e18);
        assertEq(randomToken.balanceOf(address(oethVault)), 0);
    }

    function test_transferToken_RevertWhen_vaultAsset() public {
        vm.prank(governor);
        vm.expectRevert("Only unsupported asset");
        oethVault.transferToken(address(weth), 1e18);
    }

    function test_transferToken_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        oethVault.transferToken(address(0), 1);
    }

    //////////////////////////////////////////////////////
    /// --- APPROVESTRATEGY
    //////////////////////////////////////////////////////

    function test_approveStrategy_works() public {
        MockStrategy strategy = new MockStrategy();
        strategy.setWithdrawAll(address(weth), address(oethVault));

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.StrategyApproved(address(strategy));
        oethVault.approveStrategy(address(strategy));

        assertTrue(oethVault.strategies(address(strategy)).isSupported);
    }

    function test_approveStrategy_RevertWhen_alreadyApproved() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        vm.expectRevert("Strategy already approved");
        oethVault.approveStrategy(address(strategy));
    }

    function test_approveStrategy_RevertWhen_assetNotSupported() public {
        MockStrategy strategy = new MockStrategy();
        strategy.setShouldSupportAsset(false);

        vm.prank(governor);
        vm.expectRevert("Asset not supported by Strategy");
        oethVault.approveStrategy(address(strategy));
    }

    function test_approveStrategy_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        oethVault.approveStrategy(alice);
    }

    //////////////////////////////////////////////////////
    /// --- REMOVESTRATEGY
    //////////////////////////////////////////////////////

    function test_removeStrategy_works() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.StrategyRemoved(address(strategy));
        oethVault.removeStrategy(address(strategy));

        assertFalse(oethVault.strategies(address(strategy)).isSupported);
        assertEq(oethVault.getAllStrategies().length, 0);
    }

    function test_removeStrategy_RevertWhen_notApproved() public {
        vm.prank(governor);
        vm.expectRevert("Strategy not approved");
        oethVault.removeStrategy(alice);
    }

    function test_removeStrategy_RevertWhen_isDefault() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        oethVault.setDefaultStrategy(address(strategy));

        vm.expectRevert("Strategy is default for asset");
        oethVault.removeStrategy(address(strategy));
        vm.stopPrank();
    }

    function test_removeStrategy_RevertWhen_hasFunds() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        // Deposit WETH to the strategy
        vm.prank(governor);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(100e18)));

        // Make the strategy not withdraw all (setWithdrawAll to 0 address so it fails to transfer)
        // Instead, use setNextBalance to fake a high balance after withdrawAll
        strategy.setNextBalance(100e18);

        vm.prank(governor);
        vm.expectRevert("Strategy has funds");
        oethVault.removeStrategy(address(strategy));
    }

    //////////////////////////////////////////////////////
    /// --- ADDSTRATEGYTOMINTWHITELIST
    //////////////////////////////////////////////////////

    function test_addStrategyToMintWhitelist_works() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.StrategyAddedToMintWhitelist(address(strategy));
        oethVault.addStrategyToMintWhitelist(address(strategy));

        assertTrue(oethVault.isMintWhitelistedStrategy(address(strategy)));
    }

    function test_addStrategyToMintWhitelist_RevertWhen_notApproved() public {
        vm.prank(governor);
        vm.expectRevert("Strategy not approved");
        oethVault.addStrategyToMintWhitelist(alice);
    }

    function test_addStrategyToMintWhitelist_RevertWhen_alreadyWhitelisted() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        oethVault.addStrategyToMintWhitelist(address(strategy));

        vm.expectRevert("Already whitelisted");
        oethVault.addStrategyToMintWhitelist(address(strategy));
        vm.stopPrank();
    }

    //////////////////////////////////////////////////////
    /// --- REMOVESTRATEGYFROM MINTWHITELIST
    //////////////////////////////////////////////////////

    function test_removeStrategyFromMintWhitelist_RevertWhen_notWhitelisted() public {
        vm.prank(governor);
        vm.expectRevert("Not whitelisted");
        oethVault.removeStrategyFromMintWhitelist(alice);
    }

    //////////////////////////////////////////////////////
    /// --- SETSTRATEGISTADDR
    //////////////////////////////////////////////////////

    function test_setStrategistAddr_works() public {
        vm.prank(governor);
        oethVault.setStrategistAddr(alice);
        assertEq(oethVault.strategistAddr(), alice);
    }

    function test_setStrategistAddr_emitsEvent() public {
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit IVault.StrategistUpdated(alice);
        oethVault.setStrategistAddr(alice);
    }

    function test_setStrategistAddr_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        oethVault.setStrategistAddr(alice);
    }

    //////////////////////////////////////////////////////
    /// --- _WITHDRAWFROMSTRATEGY — "PARAMETER LENGTH MISMATCH"
    //////////////////////////////////////////////////////

    function test_withdrawFromStrategy_RevertWhen_parameterLengthMismatch() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        address[] memory assets = new address[](2);
        assets[0] = address(weth);
        assets[1] = address(weth);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 50e18;

        vm.prank(governor);
        vm.expectRevert("Parameter length mismatch");
        oethVault.withdrawFromStrategy(address(strategy), assets, amounts);
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
