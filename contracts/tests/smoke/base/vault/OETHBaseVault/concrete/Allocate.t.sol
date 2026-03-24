// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHBaseVault_Shared_Test} from "tests/smoke/base/vault/OETHBaseVault/shared/Shared.t.sol";

contract Smoke_Concrete_OETHBaseVault_Allocate_Test is Smoke_OETHBaseVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ALLOCATE
    //////////////////////////////////////////////////////

    function test_depositToStrategy_movesWethFromVault() public {
        _mintOETHBase(alice, 1000 ether);
        deal(address(weth), address(oethBaseVault), weth.balanceOf(address(oethBaseVault)) + 1000 ether);

        uint256 vaultWethBefore = weth.balanceOf(address(oethBaseVault));
        uint256 stratBalanceBefore = aerodromeAMOStrategy.checkBalance(address(weth));

        address[] memory assets = new address[](1);
        assets[0] = address(weth);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1 ether;

        vm.prank(strategist);
        oethBaseVault.depositToStrategy(address(aerodromeAMOStrategy), assets, amounts);

        assertEq(weth.balanceOf(address(oethBaseVault)), vaultWethBefore - 1 ether);
        assertGe(aerodromeAMOStrategy.checkBalance(address(weth)), stratBalanceBefore + 0.99 ether);
    }

    function test_withdrawFromStrategy_movesWethToVault() public {
        _mintOETHBase(alice, 1000 ether);
        deal(address(weth), address(oethBaseVault), weth.balanceOf(address(oethBaseVault)) + 1000 ether);

        address[] memory assets = new address[](1);
        assets[0] = address(weth);
        uint256[] memory depositAmounts = new uint256[](1);
        depositAmounts[0] = 1 ether;

        vm.prank(strategist);
        oethBaseVault.depositToStrategy(address(aerodromeAMOStrategy), assets, depositAmounts);

        uint256 vaultWethBefore = weth.balanceOf(address(oethBaseVault));
        uint256 stratBalanceBefore = aerodromeAMOStrategy.checkBalance(address(weth));

        uint256[] memory withdrawAmounts = new uint256[](1);
        withdrawAmounts[0] = 0.9 ether;

        vm.prank(strategist);
        oethBaseVault.withdrawFromStrategy(address(aerodromeAMOStrategy), assets, withdrawAmounts);

        assertEq(weth.balanceOf(address(oethBaseVault)), vaultWethBefore + 0.9 ether);
        assertLe(aerodromeAMOStrategy.checkBalance(address(weth)), stratBalanceBefore - 0.89 ether);
    }

    function test_depositAndWithdraw_totalValuePreserved() public {
        _mintOETHBase(alice, 1000 ether);
        deal(address(weth), address(oethBaseVault), weth.balanceOf(address(oethBaseVault)) + 1000 ether);
        uint256 totalValueBefore = oethBaseVault.totalValue();

        address[] memory assets = new address[](1);
        assets[0] = address(weth);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1 ether;

        vm.prank(strategist);
        oethBaseVault.depositToStrategy(address(aerodromeAMOStrategy), assets, amounts);

        assertApproxEqRel(oethBaseVault.totalValue(), totalValueBefore, 1e14);

        uint256[] memory withdrawAmounts = new uint256[](1);
        withdrawAmounts[0] = 0.9 ether;

        vm.prank(strategist);
        oethBaseVault.withdrawFromStrategy(address(aerodromeAMOStrategy), assets, withdrawAmounts);

        assertApproxEqRel(oethBaseVault.totalValue(), totalValueBefore, 1e14);
    }
}
