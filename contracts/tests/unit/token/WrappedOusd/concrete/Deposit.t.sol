// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_WrappedOusd_Shared_Test} from "tests/unit/token/WrappedOusd/shared/Shared.t.sol";

contract Unit_Concrete_WrappedOusd_Deposit_Test is Unit_WrappedOusd_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- DEPOSIT + REDEEM ROUNDTRIP
    //////////////////////////////////////////////////////

    function test_deposit_basic() public {
        _mintOUSD(alice, 10e6);
        uint256 ousdBalance = ousd.balanceOf(alice);

        vm.startPrank(alice);
        ousd.approve(address(wrappedOusd), ousdBalance);
        uint256 shares = wrappedOusd.deposit(ousdBalance, alice);
        vm.stopPrank();

        assertGt(shares, 0);
        assertEq(wrappedOusd.balanceOf(alice), shares);
    }

    function test_deposit_redeemRoundtrip() public {
        uint256 shares = _mintAndDeposit(alice, 10e6);

        vm.prank(alice);
        uint256 assets = wrappedOusd.redeem(shares, alice, alice);

        assertApproxEqAbs(assets, ousd.balanceOf(alice), 1);
        assertEq(wrappedOusd.balanceOf(alice), 0);
    }

    function test_deposit_afterRebase() public {
        uint256 shares = _mintAndDeposit(alice, 10e6);
        _rebase(10e6);

        // After rebase, shares are worth more
        vm.prank(alice);
        uint256 assets = wrappedOusd.redeem(shares, alice, alice);

        // Should get back more than original 10 OUSD (10e6 USDC = 10e18 OUSD)
        assertGt(assets, 10e18);
    }

    function test_deposit_donationImmunity() public {
        _mintAndDeposit(alice, 10e6);
        uint256 sharePriceBefore = wrappedOusd.convertToAssets(1e18);

        // Donate OUSD
        _mintOUSD(bobby, 10e6);
        vm.prank(bobby);
        ousd.transfer(address(wrappedOusd), 10e18);

        // Share price unchanged
        assertEq(wrappedOusd.convertToAssets(1e18), sharePriceBefore);
    }
}
