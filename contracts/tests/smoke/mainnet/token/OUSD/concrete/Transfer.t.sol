// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OUSD_Shared_Test} from "tests/smoke/mainnet/token/OUSD/shared/Shared.t.sol";

contract Smoke_Concrete_OUSD_Transfer_Test is Smoke_OUSD_Shared_Test {
    function test_transfer() public {
        _mintOUSD(alice, 1000e6);
        uint256 aliceBefore = ousd.balanceOf(alice);

        vm.prank(alice);
        ousd.transfer(bobby, 500e18);

        assertApproxEqAbs(ousd.balanceOf(alice), aliceBefore - 500e18, 1);
        assertApproxEqAbs(ousd.balanceOf(bobby), 500e18, 1);
    }

    function test_approve_and_transferFrom() public {
        _mintOUSD(alice, 1000e6);
        uint256 aliceBefore = ousd.balanceOf(alice);

        vm.prank(alice);
        ousd.approve(bobby, 500e18);

        vm.prank(bobby);
        ousd.transferFrom(alice, bobby, 500e18);

        assertApproxEqAbs(ousd.balanceOf(alice), aliceBefore - 500e18, 1);
        assertApproxEqAbs(ousd.balanceOf(bobby), 500e18, 1);
    }

    function test_transfer_supplyInvariant() public {
        _mintOUSD(alice, 1000e6);

        vm.prank(alice);
        ousd.transfer(bobby, 500e18);

        _assertSupplyInvariant();
    }

    function test_transfer_fullBalance() public {
        _mintOUSD(alice, 1000e6);
        uint256 aliceBalance = ousd.balanceOf(alice);

        vm.prank(alice);
        ousd.transfer(bobby, aliceBalance);

        assertApproxEqAbs(ousd.balanceOf(alice), 0, 1);
        assertApproxEqAbs(ousd.balanceOf(bobby), aliceBalance, 1);
    }

    function test_transfer_toSelf() public {
        _mintOUSD(alice, 1000e6);
        uint256 aliceBalance = ousd.balanceOf(alice);

        vm.prank(alice);
        ousd.transfer(alice, 500e18);

        assertApproxEqAbs(ousd.balanceOf(alice), aliceBalance, 1);
    }
}
