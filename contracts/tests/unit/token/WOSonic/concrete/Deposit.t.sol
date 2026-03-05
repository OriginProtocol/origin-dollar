// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Unit_WOSonic_Shared_Test} from "tests/unit/token/WOSonic/shared/Shared.t.sol";

contract Unit_Concrete_WOSonic_Deposit_Test is Unit_WOSonic_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- DEPOSIT + REDEEM ROUNDTRIP
    //////////////////////////////////////////////////////

    function test_deposit_basic() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);

        assertEq(shares, 10e18);
        assertEq(woSonic.balanceOf(alice), 10e18);
    }

    function test_deposit_redeemRoundtrip() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);

        vm.prank(alice);
        uint256 assets = woSonic.redeem(shares, alice, alice);

        assertApproxEqAbs(assets, 10e18, 1);
        assertEq(woSonic.balanceOf(alice), 0);
    }

    function test_deposit_afterRebase() public {
        uint256 shares = _mintAndDeposit(alice, 10e18);
        _rebase(10e18);

        vm.prank(alice);
        uint256 assets = woSonic.redeem(shares, alice, alice);

        assertGt(assets, 10e18);
    }

    function test_deposit_donationImmunity() public {
        _mintAndDeposit(alice, 10e18);
        uint256 sharePriceBefore = woSonic.convertToAssets(1e18);

        _mintOSonic(bobby, 10e18);
        vm.prank(bobby);
        IERC20(address(oSonic)).transfer(address(woSonic), 10e18);

        assertEq(woSonic.convertToAssets(1e18), sharePriceBefore);
    }
}
