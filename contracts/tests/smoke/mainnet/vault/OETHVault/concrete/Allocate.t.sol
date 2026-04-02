// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHVault_Shared_Test} from "tests/smoke/mainnet/vault/OETHVault/shared/Shared.t.sol";

contract Smoke_Concrete_OETHVault_Allocate_Test is Smoke_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ALLOCATE
    //////////////////////////////////////////////////////

    function test_depositToStrategy_movesWethFromVault() public {
        _mintOETH(alice, 100 ether);
        _ensureAssetAvailable(10 ether);

        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));
        uint256 stratBalanceBefore = curveAMOStrategy.checkBalance(address(weth));

        address[] memory assets = new address[](1);
        assets[0] = address(weth);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1 ether;

        vm.prank(strategist);
        oethVault.depositToStrategy(address(curveAMOStrategy), assets, amounts);

        assertEq(weth.balanceOf(address(oethVault)), vaultWethBefore - 1 ether);
        assertGe(curveAMOStrategy.checkBalance(address(weth)), stratBalanceBefore + 0.99 ether);
    }

    function test_withdrawFromStrategy_movesWethToVault() public {
        _mintOETH(alice, 100 ether);
        _ensureAssetAvailable(10 ether);

        address[] memory assets = new address[](1);
        assets[0] = address(weth);
        uint256[] memory depositAmounts = new uint256[](1);
        depositAmounts[0] = 1 ether;

        vm.prank(strategist);
        oethVault.depositToStrategy(address(curveAMOStrategy), assets, depositAmounts);

        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));
        uint256 stratBalanceBefore = curveAMOStrategy.checkBalance(address(weth));

        uint256[] memory withdrawAmounts = new uint256[](1);
        withdrawAmounts[0] = 0.9 ether;

        vm.prank(strategist);
        oethVault.withdrawFromStrategy(address(curveAMOStrategy), assets, withdrawAmounts);

        assertEq(weth.balanceOf(address(oethVault)), vaultWethBefore + 0.9 ether);
        assertLe(curveAMOStrategy.checkBalance(address(weth)), stratBalanceBefore - 0.89 ether);
    }

    function test_depositAndWithdraw_totalValuePreserved() public {
        _mintOETH(alice, 100 ether);
        _ensureAssetAvailable(10 ether);
        uint256 totalValueBefore = oethVault.totalValue();

        address[] memory assets = new address[](1);
        assets[0] = address(weth);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1 ether;

        vm.prank(strategist);
        oethVault.depositToStrategy(address(curveAMOStrategy), assets, amounts);

        assertApproxEqRel(oethVault.totalValue(), totalValueBefore, 1e14);

        uint256[] memory withdrawAmounts = new uint256[](1);
        withdrawAmounts[0] = 0.9 ether;

        vm.prank(strategist);
        oethVault.withdrawFromStrategy(address(curveAMOStrategy), assets, withdrawAmounts);

        assertApproxEqRel(oethVault.totalValue(), totalValueBefore, 1e14);
    }
}
