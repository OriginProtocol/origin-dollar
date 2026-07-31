// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETH_Shared_Test} from "tests/smoke/mainnet/token/OETH/shared/Shared.t.sol";

contract Smoke_Concrete_OETH_Rebasing_Test is Smoke_OETH_Shared_Test {
    function test_rebase_increasesRebasingBalance() public {
        _mintOETH(alice, 1e18);
        uint256 balanceBefore = oeth.balanceOf(alice);

        _rebase(0.1e18);

        assertGt(oeth.balanceOf(alice), balanceBefore);
    }

    function test_rebase_doesNotAffectNonRebasing() public {
        _mintOETH(alice, 1e18);

        vm.prank(alice);
        oeth.rebaseOptOut();

        uint256 balanceBefore = oeth.balanceOf(alice);

        _rebase(0.1e18);

        assertEq(oeth.balanceOf(alice), balanceBefore);
    }

    function test_rebaseOptOut_and_optIn() public {
        _mintOETH(alice, 1e18);

        // Opt out
        vm.prank(alice);
        oeth.rebaseOptOut();

        uint256 balanceAfterOptOut = oeth.balanceOf(alice);

        // Rebase should not affect alice
        _rebase(0.1e18);
        assertEq(oeth.balanceOf(alice), balanceAfterOptOut);

        // Opt back in
        vm.prank(alice);
        oeth.rebaseOptIn();

        // Rebase should now affect alice
        uint256 balanceAfterOptIn = oeth.balanceOf(alice);
        _rebase(0.1e18);
        assertGt(oeth.balanceOf(alice), balanceAfterOptIn);
    }

    function test_rebase_supplyInvariant() public {
        _mintOETH(alice, 1e18);
        _rebase(0.1e18);
        _assertSupplyInvariant();
    }

    function test_rebase_optInOptOutLoop_noInflation() public {
        _mintOETH(alice, 1e18);
        uint256 balanceInitial = oeth.balanceOf(alice);

        for (uint256 i = 0; i < 10; i++) {
            vm.prank(alice);
            oeth.rebaseOptOut();
            vm.prank(alice);
            oeth.rebaseOptIn();
        }

        assertApproxEqAbs(oeth.balanceOf(alice), balanceInitial, 10);
    }

    function test_governanceRebaseOptIn() public {
        address contractAddr = makeAddr("ContractWithCode");
        vm.etch(contractAddr, hex"00");

        _mintOETH(contractAddr, 1e18);
        uint256 balanceBefore = oeth.balanceOf(contractAddr);

        // Rebase should not affect non-rebasing contract
        _rebase(0.1e18);
        assertEq(oeth.balanceOf(contractAddr), balanceBefore);

        // Governance opts the contract in
        vm.prank(governor);
        oeth.governanceRebaseOptIn(contractAddr);

        // Now rebase should affect it
        _rebase(0.1e18);
        assertGt(oeth.balanceOf(contractAddr), balanceBefore);
    }
}
