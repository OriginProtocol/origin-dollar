// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OSVault_Shared_Test} from "tests/smoke/sonic/vault/OSVault/shared/Shared.t.sol";

contract Smoke_Concrete_OSVault_Allocate_Test is Smoke_OSVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ALLOCATE
    //////////////////////////////////////////////////////

    function test_depositToStrategy_movesWsFromVault() public {
        _mintOSonic(alice, 10_000 ether);
        // Settle any outstanding withdrawal queue shortfall first, then add extra liquidity
        _ensureVaultLiquidity(0);
        deal(address(wrappedSonic), address(oSonicVault), wrappedSonic.balanceOf(address(oSonicVault)) + 1000 ether);

        uint256 vaultWsBefore = wrappedSonic.balanceOf(address(oSonicVault));
        uint256 stratBalanceBefore = sonicSwapXAMOStrategy.checkBalance(address(wrappedSonic));

        address[] memory assets = new address[](1);
        assets[0] = address(wrappedSonic);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 ether;

        vm.prank(strategist);
        oSonicVault.depositToStrategy(address(sonicSwapXAMOStrategy), assets, amounts);

        assertEq(wrappedSonic.balanceOf(address(oSonicVault)), vaultWsBefore - 100 ether);
        assertGe(sonicSwapXAMOStrategy.checkBalance(address(wrappedSonic)), stratBalanceBefore + 99 ether);
    }

    function test_withdrawFromStrategy_movesWsToVault() public {
        _mintOSonic(alice, 10_000 ether);
        _ensureVaultLiquidity(0);
        deal(address(wrappedSonic), address(oSonicVault), wrappedSonic.balanceOf(address(oSonicVault)) + 1000 ether);

        address[] memory assets = new address[](1);
        assets[0] = address(wrappedSonic);
        uint256[] memory depositAmounts = new uint256[](1);
        depositAmounts[0] = 100 ether;

        vm.prank(strategist);
        oSonicVault.depositToStrategy(address(sonicSwapXAMOStrategy), assets, depositAmounts);

        uint256 vaultWsBefore = wrappedSonic.balanceOf(address(oSonicVault));
        uint256 stratBalanceBefore = sonicSwapXAMOStrategy.checkBalance(address(wrappedSonic));

        uint256[] memory withdrawAmounts = new uint256[](1);
        withdrawAmounts[0] = 90 ether;

        vm.prank(strategist);
        oSonicVault.withdrawFromStrategy(address(sonicSwapXAMOStrategy), assets, withdrawAmounts);

        assertEq(wrappedSonic.balanceOf(address(oSonicVault)), vaultWsBefore + 90 ether);
        assertLe(sonicSwapXAMOStrategy.checkBalance(address(wrappedSonic)), stratBalanceBefore - 89 ether);
    }

    function test_depositAndWithdraw_totalValuePreserved() public {
        _mintOSonic(alice, 10_000 ether);
        _ensureVaultLiquidity(0);
        deal(address(wrappedSonic), address(oSonicVault), wrappedSonic.balanceOf(address(oSonicVault)) + 1000 ether);
        uint256 totalValueBefore = oSonicVault.totalValue();

        address[] memory assets = new address[](1);
        assets[0] = address(wrappedSonic);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 ether;

        vm.prank(strategist);
        oSonicVault.depositToStrategy(address(sonicSwapXAMOStrategy), assets, amounts);

        assertApproxEqRel(oSonicVault.totalValue(), totalValueBefore, 1e14);

        uint256[] memory withdrawAmounts = new uint256[](1);
        withdrawAmounts[0] = 90 ether;

        vm.prank(strategist);
        oSonicVault.withdrawFromStrategy(address(sonicSwapXAMOStrategy), assets, withdrawAmounts);

        assertApproxEqRel(oSonicVault.totalValue(), totalValueBefore, 1e14);
    }
}
