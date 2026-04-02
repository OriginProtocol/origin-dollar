// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.t.sol";

contract Unit_Fuzz_OUSD_Transfer_Test is Unit_OUSD_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- FUZZ: TRANSFER PRESERVES TOTAL SUPPLY
    //////////////////////////////////////////////////////

    function testFuzz_transfer_preservesTotalSupply(uint256 amount) public {
        amount = bound(amount, 1e12, 100e18);

        uint256 totalSupplyBefore = ousd.totalSupply();

        vm.prank(matt);
        ousd.transfer(josh, amount);

        assertEq(ousd.totalSupply(), totalSupplyBefore);
    }

    //////////////////////////////////////////////////////
    /// --- FUZZ: TRANSFER BALANCES ADD UP
    //////////////////////////////////////////////////////

    function testFuzz_transfer_balancesAddUp(uint256 amount) public {
        amount = bound(amount, 1e12, 100e18);

        uint256 mattBefore = ousd.balanceOf(matt);
        uint256 joshBefore = ousd.balanceOf(josh);

        vm.prank(matt);
        ousd.transfer(josh, amount);

        uint256 mattAfter = ousd.balanceOf(matt);
        uint256 joshAfter = ousd.balanceOf(josh);

        // sender + receiver balances = total before (within 1 wei rounding)
        assertApproxEqAbs(mattAfter + joshAfter, mattBefore + joshBefore, 1);
    }

    //////////////////////////////////////////////////////
    /// --- FUZZ: MINT INCREASES TOTAL SUPPLY
    //////////////////////////////////////////////////////

    function testFuzz_mint_increasesTotalSupply(uint256 usdcAmount) public {
        usdcAmount = bound(usdcAmount, 1, 50e6);

        uint256 totalSupplyBefore = ousd.totalSupply();
        uint256 expectedIncrease = usdcAmount * 1e12; // USDC 6 dec -> OUSD 18 dec

        _mintOUSD(alice, usdcAmount);

        assertEq(ousd.totalSupply(), totalSupplyBefore + expectedIncrease);
    }

    //////////////////////////////////////////////////////
    /// --- FUZZ: CHANGE SUPPLY INCREASES REBASING BALANCES
    //////////////////////////////////////////////////////

    function testFuzz_changeSupply_rebasingBalancesIncrease(uint256 yieldUSDC) public {
        yieldUSDC = bound(yieldUSDC, 1, 50e6);

        uint256 mattBefore = ousd.balanceOf(matt);

        _rebase(yieldUSDC);

        // Rebasing user's balance should increase
        assertGe(ousd.balanceOf(matt), mattBefore);
    }

    //////////////////////////////////////////////////////
    /// --- FUZZ: CHANGE SUPPLY LEAVES NON-REBASING UNCHANGED
    //////////////////////////////////////////////////////

    function testFuzz_changeSupply_nonRebasingUnchanged(uint256 yieldUSDC) public {
        yieldUSDC = bound(yieldUSDC, 1, 50e6);

        // Opt out matt
        vm.prank(matt);
        ousd.rebaseOptOut();

        uint256 mattBefore = ousd.balanceOf(matt);

        _rebase(yieldUSDC);

        // Non-rebasing balance stays constant
        assertEq(ousd.balanceOf(matt), mattBefore);
    }

    //////////////////////////////////////////////////////
    /// --- FUZZ: REBASE OPT-IN / OPT-OUT PRESERVES BALANCE
    //////////////////////////////////////////////////////

    function testFuzz_rebaseOptInOptOut_preservesBalance(uint256 usdcAmount) public {
        usdcAmount = bound(usdcAmount, 1e4, 100e6);

        _mintOUSD(alice, usdcAmount);

        uint256 balanceBefore = ousd.balanceOf(alice);

        vm.startPrank(alice);
        ousd.rebaseOptOut();
        ousd.rebaseOptIn();
        vm.stopPrank();

        // Balance preserved within 1 wei
        assertApproxEqAbs(ousd.balanceOf(alice), balanceBefore, 1);
    }

    //////////////////////////////////////////////////////
    /// --- FUZZ: SUPPLY INVARIANT
    //////////////////////////////////////////////////////

    function testFuzz_supplyInvariant(uint256 mintAmount, uint256 yieldUSDC) public {
        mintAmount = bound(mintAmount, 1e4, 50e6);
        yieldUSDC = bound(yieldUSDC, 1, 50e6);

        // Mint some OUSD to alice
        _mintOUSD(alice, mintAmount);

        // Opt out alice (creates nonRebasingSupply)
        vm.prank(alice);
        ousd.rebaseOptOut();

        // Add yield
        _rebase(yieldUSDC);

        // Invariant: rebasingCreditsHighres * 1e18 / rebasingCreditsPerTokenHighres + nonRebasingSupply ≈ totalSupply
        uint256 rebasingSupply = (ousd.rebasingCreditsHighres() * 1e18) / ousd.rebasingCreditsPerTokenHighres();
        uint256 calculatedSupply = rebasingSupply + ousd.nonRebasingSupply();

        assertApproxEqAbs(calculatedSupply, ousd.totalSupply(), 1);
    }
}
