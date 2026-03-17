// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_WrappedOusd_Shared_Test} from "tests/smoke/wrappedToken/WrappedOusd/shared/Shared.t.sol";

contract Smoke_Concrete_WrappedOusd_DepositRedeem_Test is Smoke_WrappedOusd_Shared_Test {
    function test_deposit_and_withdraw_roundtrip() public {
        _mintOUSD(alice, 1000e6);
        uint256 ousdBal = ousd.balanceOf(alice);

        vm.startPrank(alice);
        ousd.approve(address(wrappedOusd), ousdBal);
        uint256 shares = wrappedOusd.deposit(ousdBal, alice);
        uint256 assetsBack = wrappedOusd.redeem(shares, alice, alice);
        vm.stopPrank();

        assertApproxEqAbs(assetsBack, ousdBal, 2);
    }

    function test_deposit_producesShares() public {
        uint256 sharesBefore = wrappedOusd.balanceOf(alice);
        _mintAndWrap(alice, 1000e6);
        assertGt(wrappedOusd.balanceOf(alice), sharesBefore);
    }

    function test_previewDeposit_matchesActual() public {
        _mintOUSD(alice, 1000e6);
        uint256 ousdBal = ousd.balanceOf(alice);
        uint256 expectedShares = wrappedOusd.previewDeposit(ousdBal);

        vm.startPrank(alice);
        ousd.approve(address(wrappedOusd), ousdBal);
        uint256 actualShares = wrappedOusd.deposit(ousdBal, alice);
        vm.stopPrank();

        assertEq(actualShares, expectedShares);
    }

    function test_multipleDepositors_canFullyRedeem() public {
        _mintAndWrap(alice, 1000e6);
        _mintAndWrap(bobby, 1000e6);

        uint256 aliceShares = wrappedOusd.balanceOf(alice);
        uint256 bobbyShares = wrappedOusd.balanceOf(bobby);

        uint256 aliceOUSDBefore = ousd.balanceOf(alice);
        uint256 bobbyOUSDBefore = ousd.balanceOf(bobby);

        vm.prank(alice);
        uint256 aliceAssets = wrappedOusd.redeem(aliceShares, alice, alice);

        vm.prank(bobby);
        uint256 bobbyAssets = wrappedOusd.redeem(bobbyShares, bobby, bobby);

        assertGt(aliceAssets, 0);
        assertGt(bobbyAssets, 0);
        assertGt(ousd.balanceOf(alice), aliceOUSDBefore);
        assertGt(ousd.balanceOf(bobby), bobbyOUSDBefore);
    }
}
