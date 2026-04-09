// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_WOETHPlume_Shared_Test} from "tests/unit/token/WOETHPlume/shared/Shared.t.sol";

contract Unit_Concrete_WOETHPlume_Deposit_Test is Unit_WOETHPlume_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- DEPOSIT + REDEEM ROUNDTRIP
    //////////////////////////////////////////////////////

    function test_deposit_basic() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);

        assertEq(shares, 10e18);
        assertEq(woethPlume.balanceOf(alice), 10e18);
    }

    function test_deposit_redeemRoundtrip() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);

        vm.prank(alice);
        uint256 assets = woethPlume.redeem(shares, alice, alice);

        assertApproxEqAbs(assets, 10e18, 1);
        assertEq(woethPlume.balanceOf(alice), 0);
    }

    function test_deposit_afterRebase() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);
        _rebase(10e18);

        vm.prank(alice);
        uint256 assets = woethPlume.redeem(shares, alice, alice);

        assertGt(assets, 10e18);
    }

    function test_deposit_donationImmunity() public {
        _mintAndDeposit(alice, 10e18);
        uint256 sharePriceBefore = woethPlume.convertToAssets(1e18);

        _mintOETH(bobby, 10e18);
        vm.prank(bobby);
        oeth.transfer(address(woethPlume), 10e18);

        assertEq(woethPlume.convertToAssets(1e18), sharePriceBefore);
    }
}
