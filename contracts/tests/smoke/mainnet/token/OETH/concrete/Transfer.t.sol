// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETH_Shared_Test} from "tests/smoke/mainnet/token/OETH/shared/Shared.t.sol";

contract Smoke_Concrete_OETH_Transfer_Test is Smoke_OETH_Shared_Test {
    function test_transfer() public {
        _mintOETH(alice, 1e18);
        uint256 aliceBefore = oeth.balanceOf(alice);

        vm.prank(alice);
        oeth.transfer(bobby, 0.5e18);

        assertApproxEqAbs(oeth.balanceOf(alice), aliceBefore - 0.5e18, 1);
        assertApproxEqAbs(oeth.balanceOf(bobby), 0.5e18, 1);
    }

    function test_approve_and_transferFrom() public {
        _mintOETH(alice, 1e18);
        uint256 aliceBefore = oeth.balanceOf(alice);

        vm.prank(alice);
        oeth.approve(bobby, 0.5e18);

        vm.prank(bobby);
        oeth.transferFrom(alice, bobby, 0.5e18);

        assertApproxEqAbs(oeth.balanceOf(alice), aliceBefore - 0.5e18, 1);
        assertApproxEqAbs(oeth.balanceOf(bobby), 0.5e18, 1);
    }

    function test_transfer_supplyInvariant() public {
        _mintOETH(alice, 1e18);

        vm.prank(alice);
        oeth.transfer(bobby, 0.5e18);

        _assertSupplyInvariant();
    }

    function test_transfer_fullBalance() public {
        _mintOETH(alice, 1e18);
        uint256 aliceBalance = oeth.balanceOf(alice);

        vm.prank(alice);
        oeth.transfer(bobby, aliceBalance);

        assertApproxEqAbs(oeth.balanceOf(alice), 0, 1);
        assertApproxEqAbs(oeth.balanceOf(bobby), aliceBalance, 1);
    }

    function test_transfer_toSelf() public {
        _mintOETH(alice, 1e18);
        uint256 aliceBalance = oeth.balanceOf(alice);

        vm.prank(alice);
        oeth.transfer(alice, 0.5e18);

        assertApproxEqAbs(oeth.balanceOf(alice), aliceBalance, 1);
    }
}
