// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OUSD_Shared_Test} from "tests/smoke/mainnet/token/OUSD/shared/Shared.t.sol";

contract Smoke_Concrete_OUSD_Rebasing_Test is Smoke_OUSD_Shared_Test {
    function test_rebase_increasesRebasingBalance() public {
        _mintOUSD(alice, 1000e6);
        uint256 balanceBefore = ousd.balanceOf(alice);

        _rebase(100e6);

        assertGt(ousd.balanceOf(alice), balanceBefore);
    }

    function test_rebase_doesNotAffectNonRebasing() public {
        _mintOUSD(alice, 1000e6);

        vm.prank(alice);
        ousd.rebaseOptOut();

        uint256 balanceBefore = ousd.balanceOf(alice);

        _rebase(100e6);

        assertEq(ousd.balanceOf(alice), balanceBefore);
    }

    function test_rebaseOptOut_and_optIn() public {
        _mintOUSD(alice, 1000e6);

        // Opt out
        vm.prank(alice);
        ousd.rebaseOptOut();

        uint256 balanceAfterOptOut = ousd.balanceOf(alice);

        // Rebase should not affect alice
        _rebase(100e6);
        assertEq(ousd.balanceOf(alice), balanceAfterOptOut);

        // Opt back in
        vm.prank(alice);
        ousd.rebaseOptIn();

        // Rebase should now affect alice
        uint256 balanceAfterOptIn = ousd.balanceOf(alice);
        _rebase(100e6);
        assertGt(ousd.balanceOf(alice), balanceAfterOptIn);
    }

    function test_rebase_supplyInvariant() public {
        _mintOUSD(alice, 1000e6);
        _rebase(100e6);
        _assertSupplyInvariant();
    }

    function test_rebase_optInOptOutLoop_noInflation() public {
        _mintOUSD(alice, 1000e6);
        uint256 balanceInitial = ousd.balanceOf(alice);

        for (uint256 i = 0; i < 10; i++) {
            vm.prank(alice);
            ousd.rebaseOptOut();
            vm.prank(alice);
            ousd.rebaseOptIn();
        }

        assertApproxEqAbs(ousd.balanceOf(alice), balanceInitial, 10);
    }

    function test_governanceRebaseOptIn() public {
        address contractAddr = makeAddr("ContractWithCode");
        vm.etch(contractAddr, hex"00");

        _mintOUSD(contractAddr, 1000e6);
        uint256 balanceBefore = ousd.balanceOf(contractAddr);

        // Rebase should not affect non-rebasing contract
        _rebase(100e6);
        assertEq(ousd.balanceOf(contractAddr), balanceBefore);

        // Governance opts the contract in
        vm.prank(governor);
        ousd.governanceRebaseOptIn(contractAddr);

        // Now rebase should affect it
        _rebase(100e6);
        assertGt(ousd.balanceOf(contractAddr), balanceBefore);
    }
}
