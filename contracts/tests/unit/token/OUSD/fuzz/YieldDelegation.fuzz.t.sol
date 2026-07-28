// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.t.sol";

contract Unit_Fuzz_OUSD_YieldDelegation_Test is Unit_OUSD_Shared_Test {
    /// @notice Transferring into a yield delegation source preserves balances and global supply accounting.
    function testFuzz_transfer_toYieldDelegationSource_preservesAccounting(uint256 amount) public {
        amount = bound(amount, 1e12, 100e18);

        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        uint256 mattBalanceBefore = ousd.balanceOf(matt);
        uint256 aliceBalanceBefore = ousd.balanceOf(alice);
        uint256 joshBalanceBefore = ousd.balanceOf(josh);
        uint256 totalSupplyBefore = ousd.totalSupply();
        uint256 nonRebasingSupplyBefore = ousd.nonRebasingSupply();

        vm.prank(josh);
        ousd.transfer(matt, amount);

        assertApproxEqAbs(ousd.balanceOf(matt), mattBalanceBefore + amount, 1);
        assertApproxEqAbs(ousd.balanceOf(alice), aliceBalanceBefore, 1);
        assertApproxEqAbs(ousd.balanceOf(josh), joshBalanceBefore - amount, 1);
        assertEq(ousd.totalSupply(), totalSupplyBefore);
        assertEq(ousd.nonRebasingSupply(), nonRebasingSupplyBefore);
        _assertSupplyInvariant();
    }

    /// @notice Transferring out of a yield delegation target preserves balances and global supply accounting.
    function testFuzz_transfer_fromYieldDelegationTarget_preservesAccounting(uint256 amount) public {
        amount = bound(amount, 1e12, 50e18);

        vm.prank(josh);
        ousd.transfer(alice, 50e18);

        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        uint256 mattBalanceBefore = ousd.balanceOf(matt);
        uint256 aliceBalanceBefore = ousd.balanceOf(alice);
        uint256 bobbyBalanceBefore = ousd.balanceOf(bobby);
        uint256 totalSupplyBefore = ousd.totalSupply();
        uint256 nonRebasingSupplyBefore = ousd.nonRebasingSupply();

        vm.prank(alice);
        ousd.transfer(bobby, amount);

        assertApproxEqAbs(ousd.balanceOf(matt), mattBalanceBefore, 1);
        assertApproxEqAbs(ousd.balanceOf(alice), aliceBalanceBefore - amount, 1);
        assertApproxEqAbs(ousd.balanceOf(bobby), bobbyBalanceBefore + amount, 1);
        assertEq(ousd.totalSupply(), totalSupplyBefore);
        assertEq(ousd.nonRebasingSupply(), nonRebasingSupplyBefore);
        _assertSupplyInvariant();
    }

    /// @notice Minting into a yield delegation source updates its balance and total supply without changing non-rebasing supply.
    function testFuzz_mint_toYieldDelegationSource_preservesAccounting(uint256 amount) public {
        amount = bound(amount, 1e12, 100e18);

        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        uint256 mattBalanceBefore = ousd.balanceOf(matt);
        uint256 aliceBalanceBefore = ousd.balanceOf(alice);
        uint256 totalSupplyBefore = ousd.totalSupply();
        uint256 nonRebasingSupplyBefore = ousd.nonRebasingSupply();

        vm.prank(address(ousdVault));
        ousd.mint(matt, amount);

        assertApproxEqAbs(ousd.balanceOf(matt), mattBalanceBefore + amount, 1);
        assertApproxEqAbs(ousd.balanceOf(alice), aliceBalanceBefore, 1);
        assertEq(ousd.totalSupply(), totalSupplyBefore + amount);
        assertEq(ousd.nonRebasingSupply(), nonRebasingSupplyBefore);
        _assertSupplyInvariant();
    }

    /// @notice Minting into a yield delegation target updates its balance and total supply without changing non-rebasing supply.
    function testFuzz_mint_toYieldDelegationTarget_preservesAccounting(uint256 amount) public {
        amount = bound(amount, 1e12, 100e18);

        vm.prank(governor);
        ousd.delegateYield(matt, alice);

        uint256 mattBalanceBefore = ousd.balanceOf(matt);
        uint256 aliceBalanceBefore = ousd.balanceOf(alice);
        uint256 totalSupplyBefore = ousd.totalSupply();
        uint256 nonRebasingSupplyBefore = ousd.nonRebasingSupply();

        vm.prank(address(ousdVault));
        ousd.mint(alice, amount);

        assertApproxEqAbs(ousd.balanceOf(matt), mattBalanceBefore, 1);
        assertApproxEqAbs(ousd.balanceOf(alice), aliceBalanceBefore + amount, 1);
        assertEq(ousd.totalSupply(), totalSupplyBefore + amount);
        assertEq(ousd.nonRebasingSupply(), nonRebasingSupplyBefore);
        _assertSupplyInvariant();
    }
}
