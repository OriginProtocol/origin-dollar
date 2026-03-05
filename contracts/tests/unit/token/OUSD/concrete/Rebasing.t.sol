// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.t.sol";
import {OUSD} from "contracts/token/OUSD.sol";

contract Unit_Concrete_OUSD_Rebasing_Test is Unit_OUSD_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REBASE OPT-IN
    //////////////////////////////////////////////////////

    function test_rebaseOptIn() public {
        // Give contract some OUSD (auto-migrates to non-rebasing)
        vm.prank(josh);
        ousd.transfer(address(mockNonRebasing), 99.5e18);

        assertApproxEqAbs(ousd.balanceOf(address(mockNonRebasing)), 99.5e18, 0);

        // Simulate yield
        _rebase(200e6);

        // Contract balance unchanged (non-rebasing)
        assertApproxEqAbs(ousd.balanceOf(address(mockNonRebasing)), 99.5e18, 0);
        uint256 totalSupplyBefore = ousd.totalSupply();

        // Opt in
        mockNonRebasing.rebaseOptIn();

        // Balance preserved after opt-in
        assertApproxEqAbs(ousd.balanceOf(address(mockNonRebasing)), 99.5e18, 1);
        // totalSupply unchanged
        assertEq(ousd.totalSupply(), totalSupplyBefore);
    }

    function test_rebaseOptIn_emitsEvent() public {
        vm.prank(josh);
        ousd.transfer(address(mockNonRebasing), 50e18);

        vm.expectEmit(false, false, false, true);
        emit OUSD.AccountRebasingEnabled(address(mockNonRebasing));

        mockNonRebasing.rebaseOptIn();
    }

    function test_rebaseOptIn_updatesGlobals() public {
        vm.prank(josh);
        ousd.transfer(address(mockNonRebasing), 50e18);

        uint256 nonRebasingBefore = ousd.nonRebasingSupply();
        uint256 rebasingCreditsBefore = ousd.rebasingCreditsHighres();

        mockNonRebasing.rebaseOptIn();

        // nonRebasingSupply decreased
        assertEq(ousd.nonRebasingSupply(), nonRebasingBefore - 50e18);
        // rebasingCredits increased
        assertGt(ousd.rebasingCreditsHighres(), rebasingCreditsBefore);
    }

    function test_rebaseOptIn_RevertWhen_alreadyRebasing() public {
        // matt is already rebasing (EOA default)
        vm.prank(matt);
        vm.expectRevert("Account must be non-rebasing");
        ousd.rebaseOptIn();
    }

    function test_rebaseOptIn_RevertWhen_yieldDelegationSource() public {
        vm.prank(governor);
        ousd.delegateYield(matt, josh);

        vm.prank(matt);
        vm.expectRevert("Only standard non-rebasing accounts can opt in");
        ousd.rebaseOptIn();
    }

    function test_rebaseOptIn_withZeroBalance() public {
        // alice has never held OUSD — rebaseState is NotSet, creditBalance is 0
        // This is allowed: zero-balance accounts can explicitly opt in
        vm.prank(alice);
        ousd.rebaseOptIn();

        assertEq(uint256(ousd.rebaseState(alice)), 2); // StdRebasing
    }

    function test_rebaseOptIn_contractCanOptInBeforeAutoMigrate() public {
        // mockNonRebasing has NotSet state and 0 balance — no auto-migration yet
        mockNonRebasing.rebaseOptIn();

        assertEq(uint256(ousd.rebaseState(address(mockNonRebasing))), 2); // StdRebasing
    }

    function test_rebaseOptIn_contractCannotDoubleOptIn() public {
        mockNonRebasing.rebaseOptIn();

        vm.expectRevert("Only standard non-rebasing accounts can opt in");
        mockNonRebasing.rebaseOptIn();
    }

    //////////////////////////////////////////////////////
    /// --- REBASE OPT-OUT
    //////////////////////////////////////////////////////

    function test_rebaseOptOut() public {
        // Simulate yield via changeSupply so matt has increased balance
        _changeSupply(400e18); // 200 yield split equally: matt=200, josh=200
        assertApproxEqAbs(ousd.balanceOf(matt), 200e18, 1);

        uint256 totalSupplyBefore = ousd.totalSupply();

        vm.prank(matt);
        ousd.rebaseOptOut();

        // Balance preserved
        assertApproxEqAbs(ousd.balanceOf(matt), 200e18, 1);
        // totalSupply unchanged
        assertEq(ousd.totalSupply(), totalSupplyBefore);
        // Account state
        assertEq(uint256(ousd.rebaseState(matt)), 1); // StdNonRebasing
    }

    function test_rebaseOptOut_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit OUSD.AccountRebasingDisabled(matt);

        vm.prank(matt);
        ousd.rebaseOptOut();
    }

    function test_rebaseOptOut_updatesGlobals() public {
        uint256 rebasingCreditsBefore = ousd.rebasingCreditsHighres();

        vm.prank(matt);
        ousd.rebaseOptOut();

        // nonRebasingSupply increased by matt's balance
        assertEq(ousd.nonRebasingSupply(), 100e18);
        // rebasingCredits decreased
        assertLt(ousd.rebasingCreditsHighres(), rebasingCreditsBefore);
    }

    function test_rebaseOptOut_RevertWhen_alreadyNonRebasing() public {
        vm.prank(matt);
        ousd.rebaseOptOut();

        vm.prank(matt);
        vm.expectRevert("Account must be rebasing");
        ousd.rebaseOptOut();
    }

    function test_rebaseOptOut_RevertWhen_yieldDelegationTarget() public {
        vm.prank(governor);
        ousd.delegateYield(matt, josh);

        vm.prank(josh);
        vm.expectRevert("Only standard rebasing accounts can opt out");
        ousd.rebaseOptOut();
    }

    function test_rebaseOptOut_contractWithNotSetState() public {
        // Contract with NotSet state (no prior interaction) can opt out
        mockNonRebasing.rebaseOptOut();
        assertEq(uint256(ousd.rebaseState(address(mockNonRebasing))), 1); // StdNonRebasing
    }

    function test_rebaseOptOut_contractAlreadyAutoMigrated_reverts() public {
        // Trigger auto-migration
        vm.prank(matt);
        ousd.transfer(address(mockNonRebasing), 1e18);

        // Already non-rebasing, can't opt out again
        vm.expectRevert("Account must be rebasing");
        mockNonRebasing.rebaseOptOut();
    }

    //////////////////////////////////////////////////////
    /// --- OPT-IN / OPT-OUT LOOP
    //////////////////////////////////////////////////////

    function test_rebaseOptInOptOut_loopDoesNotInflateBalance() public {
        _rebase(200e6);

        vm.startPrank(josh);
        ousd.rebaseOptOut();
        ousd.rebaseOptIn();
        vm.stopPrank();

        uint256 balanceBefore = ousd.balanceOf(josh);

        vm.startPrank(josh);
        for (uint256 i = 0; i < 10; i++) {
            ousd.rebaseOptOut();
            ousd.rebaseOptIn();
        }
        vm.stopPrank();

        assertEq(ousd.balanceOf(josh), balanceBefore);
    }

    //////////////////////////////////////////////////////
    /// --- GOVERNANCE REBASE OPT-IN
    //////////////////////////////////////////////////////

    function test_governanceRebaseOptIn() public {
        // First auto-migrate by transferring to contract
        vm.prank(josh);
        ousd.transfer(address(mockNonRebasing), 50e18);

        // Governor can force opt-in
        vm.prank(governor);
        ousd.governanceRebaseOptIn(address(mockNonRebasing));

        assertEq(uint256(ousd.rebaseState(address(mockNonRebasing))), 2); // StdRebasing
    }

    function test_governanceRebaseOptIn_RevertWhen_notGovernor() public {
        vm.prank(matt);
        vm.expectRevert("Caller is not the Governor");
        ousd.governanceRebaseOptIn(address(mockNonRebasing));
    }

    function test_governanceRebaseOptIn_RevertWhen_zeroAddress() public {
        vm.prank(governor);
        vm.expectRevert("Zero address not allowed");
        ousd.governanceRebaseOptIn(address(0));
    }

    //////////////////////////////////////////////////////
    /// --- CHANGE SUPPLY
    //////////////////////////////////////////////////////

    function test_changeSupply_increasesRebasingBalances() public {
        // Opt out matt so we can compare
        vm.prank(matt);
        ousd.rebaseOptOut();

        uint256 mattBefore = ousd.balanceOf(matt);
        uint256 joshBefore = ousd.balanceOf(josh);

        // Increase supply by 100
        _changeSupply(300e18);

        // Non-rebasing unchanged
        assertEq(ousd.balanceOf(matt), mattBefore);
        // Rebasing gains
        assertApproxEqAbs(ousd.balanceOf(josh), joshBefore + 100e18, 1);
    }

    function test_changeSupply_noChange_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit OUSD.TotalSupplyUpdatedHighres(
            ousd.totalSupply(), ousd.rebasingCreditsHighres(), ousd.rebasingCreditsPerTokenHighres()
        );

        _changeSupply(ousd.totalSupply());
    }

    function test_changeSupply_RevertWhen_notVault() public {
        vm.prank(matt);
        vm.expectRevert("Caller is not the Vault");
        ousd.changeSupply(300e18);
    }

    function test_changeSupply_RevertWhen_zeroSupply() public {
        // Burn everything
        vm.startPrank(address(ousdVault));
        ousd.burn(matt, 100e18);
        ousd.burn(josh, 100e18);
        vm.stopPrank();

        vm.prank(address(ousdVault));
        vm.expectRevert("Cannot increase 0 supply");
        ousd.changeSupply(100e18);
    }

    function test_changeSupply_capsAtMaxSupply() public {
        uint256 maxSupply = type(uint128).max;
        _changeSupply(maxSupply + 1);

        assertEq(ousd.totalSupply(), maxSupply);
    }

    //////////////////////////////////////////////////////
    /// --- YIELD DISTRIBUTION
    //////////////////////////////////////////////////////

    function test_rebase_yieldOnlyGoesToRebasingUsers() public {
        // Opt out matt
        vm.prank(matt);
        ousd.rebaseOptOut();

        uint256 mattBefore = ousd.balanceOf(matt);
        uint256 joshBefore = ousd.balanceOf(josh);

        // Transfer 1 to alice so we have two rebasing users at different balances
        vm.prank(josh);
        ousd.transfer(alice, 1e18);

        // Increase supply by 2 OUSD
        _rebase(2e6);

        // Non-rebasing unchanged
        assertEq(ousd.balanceOf(matt), mattBefore);

        // Josh: (99/100) * 2 + 99 ~= 100.98
        // Alice: (1/100) * 2 + 1 ~= 1.02
        // Both should have gained proportionally
        assertApproxEqAbs(ousd.balanceOf(josh), 100.98e18, 1);
        assertApproxEqAbs(ousd.balanceOf(alice), 1.02e18, 1);
    }

    function test_rebase_userBalancesIncreaseProperly() public {
        // Transfer 1 from matt to alice
        vm.prank(matt);
        ousd.transfer(alice, 1e18);

        assertEq(ousd.balanceOf(matt), 99e18);
        assertEq(ousd.balanceOf(alice), 1e18);

        // Increase total supply by 2 OUSD (via 2 USDC yield)
        _rebase(2e6);

        // Contract originally contained 200 OUSD, now has 202
        // Matt: (99/200) * 202 = 99.99
        uint256 mattExpected = 99.99e18;
        assertGe(ousd.balanceOf(matt), mattExpected - 1);
        assertLe(ousd.balanceOf(matt), mattExpected);

        // Alice: (1/200) * 202 = 1.01
        uint256 aliceExpected = 1.01e18;
        assertGe(ousd.balanceOf(alice), aliceExpected - 1);
        assertLe(ousd.balanceOf(alice), aliceExpected);
    }
}
