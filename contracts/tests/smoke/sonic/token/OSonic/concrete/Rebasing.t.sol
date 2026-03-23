// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OSonic_Shared_Test} from "tests/smoke/sonic/token/OSonic/shared/Shared.t.sol";

contract Smoke_Concrete_OSonic_Rebasing_Test is Smoke_OSonic_Shared_Test {
    function test_rebase_increasesRebasingBalance() public {
        _mintOSonic(alice, 1e18);
        uint256 balanceBefore = oSonic.balanceOf(alice);

        _rebase(0.1e18);

        assertGt(oSonic.balanceOf(alice), balanceBefore);
    }

    function test_rebase_doesNotAffectNonRebasing() public {
        _mintOSonic(alice, 1e18);

        vm.prank(alice);
        oSonic.rebaseOptOut();

        uint256 balanceBefore = oSonic.balanceOf(alice);

        _rebase(0.1e18);

        assertEq(oSonic.balanceOf(alice), balanceBefore);
    }

    function test_rebaseOptOut_and_optIn() public {
        _mintOSonic(alice, 1e18);

        // Opt out
        vm.prank(alice);
        oSonic.rebaseOptOut();

        uint256 balanceAfterOptOut = oSonic.balanceOf(alice);

        // Rebase should not affect alice
        _rebase(0.1e18);
        assertEq(oSonic.balanceOf(alice), balanceAfterOptOut);

        // Opt back in
        vm.prank(alice);
        oSonic.rebaseOptIn();

        // Rebase should now affect alice
        uint256 balanceAfterOptIn = oSonic.balanceOf(alice);
        _rebase(0.1e18);
        assertGt(oSonic.balanceOf(alice), balanceAfterOptIn);
    }

    function test_rebase_supplyInvariant() public {
        _mintOSonic(alice, 1e18);
        _rebase(0.1e18);
        _assertSupplyInvariant();
    }

    function test_rebase_optInOptOutLoop_noInflation() public {
        _mintOSonic(alice, 1e18);
        uint256 balanceInitial = oSonic.balanceOf(alice);

        for (uint256 i = 0; i < 10; i++) {
            vm.prank(alice);
            oSonic.rebaseOptOut();
            vm.prank(alice);
            oSonic.rebaseOptIn();
        }

        assertApproxEqAbs(oSonic.balanceOf(alice), balanceInitial, 10);
    }

    function test_governanceRebaseOptIn() public {
        address contractAddr = makeAddr("ContractWithCode");
        vm.etch(contractAddr, hex"00");

        _mintOSonic(contractAddr, 1e18);
        uint256 balanceBefore = oSonic.balanceOf(contractAddr);

        // Rebase should not affect non-rebasing contract
        _rebase(0.1e18);
        assertEq(oSonic.balanceOf(contractAddr), balanceBefore);

        // Governance opts the contract in
        vm.prank(governor);
        oSonic.governanceRebaseOptIn(contractAddr);

        // Now rebase should affect it
        _rebase(0.1e18);
        assertGt(oSonic.balanceOf(contractAddr), balanceBefore);
    }
}
