// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_WOETH_Shared_Test} from "tests/smoke/mainnet/token/WOETH/shared/Shared.t.sol";

contract Smoke_Concrete_WOETH_DepositRedeem_Test is Smoke_WOETH_Shared_Test {
    function test_deposit_and_withdraw_roundtrip() public {
        _mintOETH(alice, 1e18);
        uint256 oethBal = oeth.balanceOf(alice);

        vm.startPrank(alice);
        oeth.approve(address(woeth), oethBal);
        uint256 shares = woeth.deposit(oethBal, alice);
        uint256 assetsBack = woeth.redeem(shares, alice, alice);
        vm.stopPrank();

        assertApproxEqAbs(assetsBack, oethBal, 2);
    }

    function test_deposit_producesShares() public {
        uint256 sharesBefore = woeth.balanceOf(alice);
        _mintAndWrap(alice, 1e18);
        assertGt(woeth.balanceOf(alice), sharesBefore);
    }

    function test_previewDeposit_matchesActual() public {
        _mintOETH(alice, 1e18);
        uint256 oethBal = oeth.balanceOf(alice);
        uint256 expectedShares = woeth.previewDeposit(oethBal);

        vm.startPrank(alice);
        oeth.approve(address(woeth), oethBal);
        uint256 actualShares = woeth.deposit(oethBal, alice);
        vm.stopPrank();

        assertEq(actualShares, expectedShares);
    }

    function test_multipleDepositors_canFullyRedeem() public {
        _mintAndWrap(alice, 1e18);
        _mintAndWrap(bobby, 1e18);

        uint256 aliceShares = woeth.balanceOf(alice);
        uint256 bobbyShares = woeth.balanceOf(bobby);

        uint256 aliceOETHBefore = oeth.balanceOf(alice);
        uint256 bobbyOETHBefore = oeth.balanceOf(bobby);

        vm.prank(alice);
        uint256 aliceAssets = woeth.redeem(aliceShares, alice, alice);

        vm.prank(bobby);
        uint256 bobbyAssets = woeth.redeem(bobbyShares, bobby, bobby);

        assertGt(aliceAssets, 0);
        assertGt(bobbyAssets, 0);
        assertGt(oeth.balanceOf(alice), aliceOETHBefore);
        assertGt(oeth.balanceOf(bobby), bobbyOETHBefore);
    }
}
