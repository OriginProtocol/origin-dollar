// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_WOETHBase_Shared_Test} from "tests/smoke/wrappedToken/WOETHBase/shared/Shared.t.sol";

contract Smoke_Concrete_WOETHBase_DepositRedeem_Test is Smoke_WOETHBase_Shared_Test {
    function test_deposit_and_withdraw_roundtrip() public {
        _mintOETHBase(alice, 1e18);
        uint256 oethBaseBal = oethBase.balanceOf(alice);

        vm.startPrank(alice);
        oethBase.approve(address(woethBase), oethBaseBal);
        uint256 shares = woethBase.deposit(oethBaseBal, alice);
        uint256 assetsBack = woethBase.redeem(shares, alice, alice);
        vm.stopPrank();

        assertApproxEqAbs(assetsBack, oethBaseBal, 2);
    }

    function test_deposit_producesShares() public {
        uint256 sharesBefore = woethBase.balanceOf(alice);
        _mintAndWrap(alice, 1e18);
        assertGt(woethBase.balanceOf(alice), sharesBefore);
    }

    function test_previewDeposit_matchesActual() public {
        _mintOETHBase(alice, 1e18);
        uint256 oethBaseBal = oethBase.balanceOf(alice);
        uint256 expectedShares = woethBase.previewDeposit(oethBaseBal);

        vm.startPrank(alice);
        oethBase.approve(address(woethBase), oethBaseBal);
        uint256 actualShares = woethBase.deposit(oethBaseBal, alice);
        vm.stopPrank();

        assertEq(actualShares, expectedShares);
    }

    function test_multipleDepositors_canFullyRedeem() public {
        _mintAndWrap(alice, 1e18);
        _mintAndWrap(bobby, 1e18);

        uint256 aliceShares = woethBase.balanceOf(alice);
        uint256 bobbyShares = woethBase.balanceOf(bobby);

        uint256 aliceOETHBaseBefore = oethBase.balanceOf(alice);
        uint256 bobbyOETHBaseBefore = oethBase.balanceOf(bobby);

        vm.prank(alice);
        uint256 aliceAssets = woethBase.redeem(aliceShares, alice, alice);

        vm.prank(bobby);
        uint256 bobbyAssets = woethBase.redeem(bobbyShares, bobby, bobby);

        assertGt(aliceAssets, 0);
        assertGt(bobbyAssets, 0);
        assertGt(oethBase.balanceOf(alice), aliceOETHBaseBefore);
        assertGt(oethBase.balanceOf(bobby), bobbyOETHBaseBefore);
    }
}
