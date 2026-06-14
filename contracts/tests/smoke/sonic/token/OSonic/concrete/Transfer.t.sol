// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OSonic_Shared_Test} from "tests/smoke/sonic/token/OSonic/shared/Shared.t.sol";

contract Smoke_Concrete_OSonic_Transfer_Test is Smoke_OSonic_Shared_Test {
    function test_transfer() public {
        _mintOSonic(alice, 1e18);
        uint256 aliceBefore = oSonic.balanceOf(alice);

        vm.prank(alice);
        oSonic.transfer(bobby, 0.5e18);

        assertApproxEqAbs(oSonic.balanceOf(alice), aliceBefore - 0.5e18, 1);
        assertApproxEqAbs(oSonic.balanceOf(bobby), 0.5e18, 1);
    }

    function test_approve_and_transferFrom() public {
        _mintOSonic(alice, 1e18);
        uint256 aliceBefore = oSonic.balanceOf(alice);

        vm.prank(alice);
        oSonic.approve(bobby, 0.5e18);

        vm.prank(bobby);
        oSonic.transferFrom(alice, bobby, 0.5e18);

        assertApproxEqAbs(oSonic.balanceOf(alice), aliceBefore - 0.5e18, 1);
        assertApproxEqAbs(oSonic.balanceOf(bobby), 0.5e18, 1);
    }

    function test_transfer_supplyInvariant() public {
        _mintOSonic(alice, 1e18);

        vm.prank(alice);
        oSonic.transfer(bobby, 0.5e18);

        _assertSupplyInvariant();
    }

    function test_transfer_fullBalance() public {
        _mintOSonic(alice, 1e18);
        uint256 aliceBalance = oSonic.balanceOf(alice);

        vm.prank(alice);
        oSonic.transfer(bobby, aliceBalance);

        assertApproxEqAbs(oSonic.balanceOf(alice), 0, 1);
        assertApproxEqAbs(oSonic.balanceOf(bobby), aliceBalance, 1);
    }

    function test_transfer_toSelf() public {
        _mintOSonic(alice, 1e18);
        uint256 aliceBalance = oSonic.balanceOf(alice);

        vm.prank(alice);
        oSonic.transfer(alice, 0.5e18);

        assertApproxEqAbs(oSonic.balanceOf(alice), aliceBalance, 1);
    }
}
