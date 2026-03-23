// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHBase_Shared_Test} from "tests/smoke/base/token/OETHBase/shared/Shared.t.sol";

contract Smoke_Concrete_OETHBase_Transfer_Test is Smoke_OETHBase_Shared_Test {
    function test_transfer() public {
        _mintOETHBase(alice, 1e18);
        uint256 aliceBefore = oethBase.balanceOf(alice);

        vm.prank(alice);
        oethBase.transfer(bobby, 0.5e18);

        assertApproxEqAbs(oethBase.balanceOf(alice), aliceBefore - 0.5e18, 1);
        assertApproxEqAbs(oethBase.balanceOf(bobby), 0.5e18, 1);
    }

    function test_approve_and_transferFrom() public {
        _mintOETHBase(alice, 1e18);
        uint256 aliceBefore = oethBase.balanceOf(alice);

        vm.prank(alice);
        oethBase.approve(bobby, 0.5e18);

        vm.prank(bobby);
        oethBase.transferFrom(alice, bobby, 0.5e18);

        assertApproxEqAbs(oethBase.balanceOf(alice), aliceBefore - 0.5e18, 1);
        assertApproxEqAbs(oethBase.balanceOf(bobby), 0.5e18, 1);
    }

    function test_transfer_supplyInvariant() public {
        _mintOETHBase(alice, 1e18);

        vm.prank(alice);
        oethBase.transfer(bobby, 0.5e18);

        _assertSupplyInvariant();
    }

    function test_transfer_fullBalance() public {
        _mintOETHBase(alice, 1e18);
        uint256 aliceBalance = oethBase.balanceOf(alice);

        vm.prank(alice);
        oethBase.transfer(bobby, aliceBalance);

        assertApproxEqAbs(oethBase.balanceOf(alice), 0, 1);
        assertApproxEqAbs(oethBase.balanceOf(bobby), aliceBalance, 1);
    }

    function test_transfer_toSelf() public {
        _mintOETHBase(alice, 1e18);
        uint256 aliceBalance = oethBase.balanceOf(alice);

        vm.prank(alice);
        oethBase.transfer(alice, 0.5e18);

        assertApproxEqAbs(oethBase.balanceOf(alice), aliceBalance, 1);
    }
}
