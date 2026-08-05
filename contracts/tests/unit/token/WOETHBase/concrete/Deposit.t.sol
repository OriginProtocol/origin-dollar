// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_WOETHBase_Shared_Test} from "tests/unit/token/WOETHBase/shared/Shared.t.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_WOETHBase_Deposit_Test is Unit_WOETHBase_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- DEPOSIT + REDEEM ROUNDTRIP
    //////////////////////////////////////////////////////

    function test_deposit_basic() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);

        assertEq(shares, 10e18);
        assertEq(woethBase.balanceOf(alice), 10e18);
    }

    function test_deposit_redeemRoundtrip() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);

        vm.prank(alice);
        uint256 assets = woethBase.redeem(shares, alice, alice);

        assertApproxEqAbs(assets, 10e18, 1);
        assertEq(woethBase.balanceOf(alice), 0);
    }

    function test_deposit_afterRebase() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);
        _rebase(10e18);

        vm.prank(alice);
        uint256 assets = woethBase.redeem(shares, alice, alice);

        assertGt(assets, 10e18);
    }

    function test_deposit_donationImmunity() public {
        _mintAndDeposit(alice, 10e18);
        uint256 sharePriceBefore = woethBase.convertToAssets(1e18);

        _mintOETHBase(bobby, 10e18);
        vm.prank(bobby);
        IERC20(address(oethBase)).transfer(address(woethBase), 10e18);

        assertEq(woethBase.convertToAssets(1e18), sharePriceBefore);
    }
}
