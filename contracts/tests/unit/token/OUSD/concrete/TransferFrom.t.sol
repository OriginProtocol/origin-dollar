// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.t.sol";
import {OUSD} from "contracts/token/OUSD.sol";

contract Unit_Concrete_OUSD_TransferFrom_Test is Unit_OUSD_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- TRANSFER FROM
    //////////////////////////////////////////////////////

    function test_transferFrom_withAllowance() public {
        vm.prank(matt);
        ousd.approve(alice, 1000e18);

        vm.prank(alice);
        ousd.transferFrom(matt, josh, 1e18);

        assertEq(ousd.balanceOf(josh), 101e18);
    }

    function test_transferFrom_reducesAllowance() public {
        vm.prank(matt);
        ousd.approve(alice, 1000e18);

        vm.prank(alice);
        ousd.transferFrom(matt, josh, 1e18);

        assertEq(ousd.allowance(matt, alice), 999e18);
    }

    function test_transferFrom_RevertWhen_noAllowance() public {
        vm.prank(alice);
        vm.expectRevert("Allowance exceeded");
        ousd.transferFrom(matt, alice, 1e18);
    }

    function test_transferFrom_RevertWhen_exceedsAllowance() public {
        vm.prank(matt);
        ousd.approve(alice, 10e18);

        vm.prank(alice);
        vm.expectRevert("Allowance exceeded");
        ousd.transferFrom(matt, alice, 100e18);
    }

    function test_transferFrom_RevertWhen_toZeroAddress() public {
        vm.prank(matt);
        ousd.approve(alice, 100e18);

        vm.prank(alice);
        vm.expectRevert("Transfer to zero address");
        ousd.transferFrom(matt, address(0), 1e18);
    }
}
