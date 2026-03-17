// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHBase_Shared_Test} from "tests/smoke/token/OETHBase/shared/Shared.t.sol";

contract Smoke_Concrete_OETHBase_Rebasing_Test is Smoke_OETHBase_Shared_Test {
    function test_rebase_increasesRebasingBalance() public {
        _mintOETHBase(alice, 1e18);
        uint256 balanceBefore = oethBase.balanceOf(alice);

        _rebase(0.1e18);

        assertGt(oethBase.balanceOf(alice), balanceBefore);
    }

    function test_rebase_doesNotAffectNonRebasing() public {
        _mintOETHBase(alice, 1e18);

        vm.prank(alice);
        oethBase.rebaseOptOut();

        uint256 balanceBefore = oethBase.balanceOf(alice);

        _rebase(0.1e18);

        assertEq(oethBase.balanceOf(alice), balanceBefore);
    }

    function test_rebaseOptOut_and_optIn() public {
        _mintOETHBase(alice, 1e18);

        // Opt out
        vm.prank(alice);
        oethBase.rebaseOptOut();

        uint256 balanceAfterOptOut = oethBase.balanceOf(alice);

        // Rebase should not affect alice
        _rebase(0.1e18);
        assertEq(oethBase.balanceOf(alice), balanceAfterOptOut);

        // Opt back in
        vm.prank(alice);
        oethBase.rebaseOptIn();

        // Rebase should now affect alice
        uint256 balanceAfterOptIn = oethBase.balanceOf(alice);
        _rebase(0.1e18);
        assertGt(oethBase.balanceOf(alice), balanceAfterOptIn);
    }

    function test_rebase_supplyInvariant() public {
        _mintOETHBase(alice, 1e18);
        _rebase(0.1e18);
        _assertSupplyInvariant();
    }

    function test_rebase_optInOptOutLoop_noInflation() public {
        _mintOETHBase(alice, 1e18);
        uint256 balanceInitial = oethBase.balanceOf(alice);

        for (uint256 i = 0; i < 10; i++) {
            vm.prank(alice);
            oethBase.rebaseOptOut();
            vm.prank(alice);
            oethBase.rebaseOptIn();
        }

        assertApproxEqAbs(oethBase.balanceOf(alice), balanceInitial, 10);
    }

    function test_governanceRebaseOptIn() public {
        address contractAddr = makeAddr("ContractWithCode");
        vm.etch(contractAddr, hex"00");

        _mintOETHBase(contractAddr, 1e18);
        uint256 balanceBefore = oethBase.balanceOf(contractAddr);

        // Rebase should not affect non-rebasing contract
        _rebase(0.1e18);
        assertEq(oethBase.balanceOf(contractAddr), balanceBefore);

        // Governance opts the contract in
        vm.prank(governor);
        oethBase.governanceRebaseOptIn(contractAddr);

        // Now rebase should affect it
        _rebase(0.1e18);
        assertGt(oethBase.balanceOf(contractAddr), balanceBefore);
    }
}
