// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.t.sol";
import {OUSD} from "contracts/token/OUSD.sol";

contract Unit_Concrete_OUSD_ViewFunctions_Test is Unit_OUSD_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- NAME / SYMBOL / DECIMALS
    //////////////////////////////////////////////////////

    function test_name() public view {
        assertEq(ousd.name(), "Origin Dollar");
    }

    function test_symbol() public view {
        assertEq(ousd.symbol(), "OUSD");
    }

    function test_decimals() public view {
        assertEq(ousd.decimals(), 18);
    }

    //////////////////////////////////////////////////////
    /// --- TOTAL SUPPLY
    //////////////////////////////////////////////////////

    function test_totalSupply_afterMint() public view {
        // matt (100e18) + josh (100e18) = 200e18
        assertEq(ousd.totalSupply(), 200e18);
    }

    //////////////////////////////////////////////////////
    /// --- BALANCE OF
    //////////////////////////////////////////////////////

    function test_balanceOf_rebasingUser() public view {
        assertEq(ousd.balanceOf(matt), 100e18);
        assertEq(ousd.balanceOf(josh), 100e18);
    }

    function test_balanceOf_zeroAddress() public view {
        assertEq(ousd.balanceOf(address(0)), 0);
    }

    function test_balanceOf_nonRebasingUser() public {
        vm.prank(matt);
        ousd.rebaseOptOut();
        assertEq(ousd.balanceOf(matt), 100e18);
    }

    function test_balanceOf_yieldDelegationSource() public {
        vm.prank(governor);
        ousd.delegateYield(matt, josh);

        // Source balance unchanged
        assertEq(ousd.balanceOf(matt), 100e18);
    }

    function test_balanceOf_yieldDelegationTarget() public {
        vm.prank(governor);
        ousd.delegateYield(matt, josh);

        // Target balance is its own balance minus the source's balance contribution to credits
        // Both had 100e18, so target sees just its own 100e18
        assertEq(ousd.balanceOf(josh), 100e18);
    }

    //////////////////////////////////////////////////////
    /// --- CREDITS BALANCE OF
    //////////////////////////////////////////////////////

    function test_creditsBalanceOf_rebasingUser() public view {
        (uint256 credits, uint256 cpt) = ousd.creditsBalanceOf(matt);
        // Low-res values (divided by 1e9)
        assertGt(credits, 0);
        assertGt(cpt, 0);
        // balance = credits * 1e18 / cpt (low res)
    }

    function test_creditsBalanceOf_nonRebasingUser() public {
        vm.prank(matt);
        ousd.rebaseOptOut();

        (uint256 credits, uint256 cpt) = ousd.creditsBalanceOf(matt);
        // Non-rebasing accounts have alternativeCPT = 1e18, low-res = 1e18 / 1e9 = 1e9
        assertEq(cpt, 1e9);
        // credits = balance = 100e18, low-res = 100e18 / 1e9 = 100e9
        assertEq(credits, 100e9);
    }

    //////////////////////////////////////////////////////
    /// --- CREDITS BALANCE OF HIGHRES
    //////////////////////////////////////////////////////

    function test_creditsBalanceOfHighres_rebasingUser() public view {
        (uint256 credits, uint256 cpt, bool isUpgraded) = ousd.creditsBalanceOfHighres(matt);
        assertGt(credits, 0);
        assertEq(cpt, ousd.rebasingCreditsPerTokenHighres());
        assertTrue(isUpgraded);
    }

    function test_creditsBalanceOfHighres_alwaysReturnsTrue() public view {
        (,, bool isUpgraded) = ousd.creditsBalanceOfHighres(alice);
        assertTrue(isUpgraded);
    }

    //////////////////////////////////////////////////////
    /// --- REBASING CREDITS PER TOKEN
    //////////////////////////////////////////////////////

    function test_rebasingCreditsPerToken() public view {
        uint256 cpt = ousd.rebasingCreditsPerToken();
        uint256 cptHighres = ousd.rebasingCreditsPerTokenHighres();
        assertEq(cpt, cptHighres / 1e9);
    }

    function test_rebasingCreditsPerTokenHighres() public view {
        uint256 cptHighres = ousd.rebasingCreditsPerTokenHighres();
        // Initialized to 1e27
        assertEq(cptHighres, 1e27);
    }

    //////////////////////////////////////////////////////
    /// --- REBASING CREDITS
    //////////////////////////////////////////////////////

    function test_rebasingCredits() public view {
        uint256 credits = ousd.rebasingCredits();
        uint256 creditsHighres = ousd.rebasingCreditsHighres();
        assertEq(credits, creditsHighres / 1e9);
    }

    function test_rebasingCreditsHighres() public view {
        uint256 creditsHighres = ousd.rebasingCreditsHighres();
        assertGt(creditsHighres, 0);
    }

    //////////////////////////////////////////////////////
    /// --- NON-REBASING SUPPLY
    //////////////////////////////////////////////////////

    function test_nonRebasingSupply_afterOptOut() public {
        assertEq(ousd.nonRebasingSupply(), 0);

        vm.prank(matt);
        ousd.rebaseOptOut();

        assertEq(ousd.nonRebasingSupply(), 100e18);
    }

    //////////////////////////////////////////////////////
    /// --- ALLOWANCE
    //////////////////////////////////////////////////////

    function test_allowance_default() public view {
        assertEq(ousd.allowance(matt, josh), 0);
    }

    function test_allowance_afterApprove() public {
        vm.prank(matt);
        ousd.approve(josh, 50e18);

        assertEq(ousd.allowance(matt, josh), 50e18);
    }
}
