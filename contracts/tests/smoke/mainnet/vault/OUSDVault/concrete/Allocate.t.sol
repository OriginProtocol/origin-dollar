// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OUSDVault_Shared_Test} from "tests/smoke/mainnet/vault/OUSDVault/shared/Shared.t.sol";

contract Smoke_Concrete_OUSDVault_Allocate_Test is Smoke_OUSDVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ALLOCATE
    //////////////////////////////////////////////////////

    function test_depositToStrategy_movesUsdcFromVault() public {
        // Mint a large amount to ensure vault has available USDC after withdrawal queue obligations
        _mintOUSD(alice, 500_000e6);
        // Deal extra USDC to vault to ensure there's enough available after queue reservations
        deal(address(usdc), address(ousdVault), usdc.balanceOf(address(ousdVault)) + 1000e6);

        uint256 vaultUsdcBefore = usdc.balanceOf(address(ousdVault));
        uint256 stratBalanceBefore = morphoV2Strategy.checkBalance(address(usdc));

        address[] memory assets = new address[](1);
        assets[0] = address(usdc);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 90e6;

        vm.prank(strategist);
        ousdVault.depositToStrategy(address(morphoV2Strategy), assets, amounts);

        assertEq(usdc.balanceOf(address(ousdVault)), vaultUsdcBefore - 90e6);
        assertGe(morphoV2Strategy.checkBalance(address(usdc)), stratBalanceBefore + 89.9e6);
    }

    function test_withdrawFromStrategy_movesUsdcToVault() public {
        // Mint and deposit to strategy first
        _mintOUSD(alice, 500_000e6);
        deal(address(usdc), address(ousdVault), usdc.balanceOf(address(ousdVault)) + 1000e6);

        address[] memory assets = new address[](1);
        assets[0] = address(usdc);
        uint256[] memory depositAmounts = new uint256[](1);
        depositAmounts[0] = 90e6;

        vm.prank(strategist);
        ousdVault.depositToStrategy(address(morphoV2Strategy), assets, depositAmounts);

        uint256 vaultUsdcBefore = usdc.balanceOf(address(ousdVault));
        uint256 stratBalanceBefore = morphoV2Strategy.checkBalance(address(usdc));

        uint256[] memory withdrawAmounts = new uint256[](1);
        withdrawAmounts[0] = 89e6;

        vm.prank(strategist);
        ousdVault.withdrawFromStrategy(address(morphoV2Strategy), assets, withdrawAmounts);

        assertEq(usdc.balanceOf(address(ousdVault)), vaultUsdcBefore + 89e6);
        assertLe(morphoV2Strategy.checkBalance(address(usdc)), stratBalanceBefore - 88.9e6);
    }

    function test_depositAndWithdraw_totalValuePreserved() public {
        _mintOUSD(alice, 500_000e6);
        deal(address(usdc), address(ousdVault), usdc.balanceOf(address(ousdVault)) + 1000e6);
        uint256 totalValueBefore = ousdVault.totalValue();

        address[] memory assets = new address[](1);
        assets[0] = address(usdc);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 90e6;

        vm.prank(strategist);
        ousdVault.depositToStrategy(address(morphoV2Strategy), assets, amounts);

        // totalValue should stay approximately the same
        assertApproxEqRel(ousdVault.totalValue(), totalValueBefore, 1e14);

        uint256[] memory withdrawAmounts = new uint256[](1);
        withdrawAmounts[0] = 89e6;

        vm.prank(strategist);
        ousdVault.withdrawFromStrategy(address(morphoV2Strategy), assets, withdrawAmounts);

        assertApproxEqRel(ousdVault.totalValue(), totalValueBefore, 1e14);
    }
}
