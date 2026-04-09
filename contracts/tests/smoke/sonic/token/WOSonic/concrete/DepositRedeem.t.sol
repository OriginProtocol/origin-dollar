// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_WOSonic_Shared_Test} from "tests/smoke/sonic/token/WOSonic/shared/Shared.t.sol";

contract Smoke_Concrete_WOSonic_DepositRedeem_Test is Smoke_WOSonic_Shared_Test {
    function test_deposit_and_withdraw_roundtrip() public {
        _mintOSonic(alice, 1e18);
        uint256 oSonicBal = oSonic.balanceOf(alice);

        vm.startPrank(alice);
        oSonic.approve(address(woSonic), oSonicBal);
        uint256 shares = woSonic.deposit(oSonicBal, alice);
        uint256 assetsBack = woSonic.redeem(shares, alice, alice);
        vm.stopPrank();

        assertApproxEqAbs(assetsBack, oSonicBal, 2);
    }

    function test_deposit_producesShares() public {
        uint256 sharesBefore = woSonic.balanceOf(alice);
        _mintAndWrap(alice, 1e18);
        assertGt(woSonic.balanceOf(alice), sharesBefore);
    }

    function test_previewDeposit_matchesActual() public {
        _mintOSonic(alice, 1e18);
        uint256 oSonicBal = oSonic.balanceOf(alice);
        uint256 expectedShares = woSonic.previewDeposit(oSonicBal);

        vm.startPrank(alice);
        oSonic.approve(address(woSonic), oSonicBal);
        uint256 actualShares = woSonic.deposit(oSonicBal, alice);
        vm.stopPrank();

        assertEq(actualShares, expectedShares);
    }

    function test_multipleDepositors_canFullyRedeem() public {
        _mintAndWrap(alice, 1e18);
        _mintAndWrap(bobby, 1e18);

        uint256 aliceShares = woSonic.balanceOf(alice);
        uint256 bobbyShares = woSonic.balanceOf(bobby);

        uint256 aliceOSonicBefore = oSonic.balanceOf(alice);
        uint256 bobbyOSonicBefore = oSonic.balanceOf(bobby);

        vm.prank(alice);
        uint256 aliceAssets = woSonic.redeem(aliceShares, alice, alice);

        vm.prank(bobby);
        uint256 bobbyAssets = woSonic.redeem(bobbyShares, bobby, bobby);

        assertGt(aliceAssets, 0);
        assertGt(bobbyAssets, 0);
        assertGt(oSonic.balanceOf(alice), aliceOSonicBefore);
        assertGt(oSonic.balanceOf(bobby), bobbyOSonicBefore);
    }
}
