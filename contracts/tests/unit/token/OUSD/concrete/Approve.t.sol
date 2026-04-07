// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.t.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";

contract Unit_Concrete_OUSD_Approve_Test is Unit_OUSD_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- APPROVE
    //////////////////////////////////////////////////////

    function test_approve() public {
        vm.prank(matt);
        ousd.approve(alice, 50e18);

        assertEq(ousd.allowance(matt, alice), 50e18);
    }

    function test_approve_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit IOToken.Approval(matt, alice, 50e18);

        vm.prank(matt);
        ousd.approve(alice, 50e18);
    }

    function test_approve_overwrite() public {
        vm.startPrank(matt);
        ousd.approve(alice, 50e18);
        ousd.approve(alice, 100e18);
        vm.stopPrank();

        assertEq(ousd.allowance(matt, alice), 100e18);
    }
}
