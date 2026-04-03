// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";
import {IOETHSupernovaAMOStrategy} from "contracts/interfaces/strategies/IOETHSupernovaAMOStrategy.sol";

contract Unit_Concrete_OETHSupernovaAMOStrategy_Deposit_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    function test_deposit_mintsProportionalOETH() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        // Pool is balanced (100e18 / 100e18), so OETH minted should equal WETH deposited
        _setupPoolReserves(100 ether, 100 ether);

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        // Balanced pool: oethAmount = (wethAmount * oethReserves) / wethReserves = amount
        assertEq(oethMinted, amount);
    }

    function test_deposit_depositsToPoolAndGauge() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);

        _depositAsVault(amount);

        // LP tokens should be staked in gauge
        assertGt(mockSwapXGauge.balanceOf(address(oethSupernovaAMOStrategy)), 0);
        // No LP tokens left in strategy
        assertEq(mockSwapXPair.balanceOf(address(oethSupernovaAMOStrategy)), 0);
    }

    function test_deposit_emitsDepositEvents() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        deal(address(mockWeth), address(oethSupernovaAMOStrategy), amount);

        // Expect Deposit event for WETH
        vm.expectEmit(true, true, true, true);
        emit IOETHSupernovaAMOStrategy.Deposit(address(mockWeth), address(mockSwapXPair), amount);

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.deposit(address(mockWeth), amount);
    }

    function test_deposit_solvencyCheck() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Verify solvency maintained
        uint256 totalValue = oethVault.totalValue();
        uint256 totalSupply = oeth.totalSupply();
        assertGe((totalValue * 1e18) / totalSupply, 0.998 ether);
    }

    function test_deposit_RevertWhen_wrongAsset() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Unsupported asset");
        oethSupernovaAMOStrategy.deposit(address(oeth), 1 ether);
    }

    function test_deposit_RevertWhen_zeroAmount() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Must deposit something");
        oethSupernovaAMOStrategy.deposit(address(mockWeth), 0);
    }

    function test_deposit_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        oethSupernovaAMOStrategy.deposit(address(mockWeth), 1 ether);
    }

    function test_deposit_RevertWhen_emptyPool() public {
        _seedVaultForSolvency(100 ether);
        _setupPoolReserves(0, 0);

        deal(address(mockWeth), address(oethSupernovaAMOStrategy), 1 ether);

        vm.prank(address(oethVault));
        vm.expectRevert("Empty pool");
        oethSupernovaAMOStrategy.deposit(address(mockWeth), 1 ether);
    }

    function test_deposit_RevertWhen_protocolInsolvent() public {
        // Mint a large amount of OETH externally to inflate supply
        vm.prank(address(oethVault));
        oeth.mint(alice, 1000 ether);

        deal(address(mockWeth), address(oethSupernovaAMOStrategy), 1 ether);

        vm.prank(address(oethVault));
        vm.expectRevert("Protocol insolvent");
        oethSupernovaAMOStrategy.deposit(address(mockWeth), 1 ether);
    }

    function test_deposit_RevertWhen_priceOutOfRange() public {
        _seedVaultForSolvency(100 ether);
        deal(address(mockWeth), address(oethSupernovaAMOStrategy), 1 ether);

        // Set amountOut to make price deviate far beyond maxDepeg (1%)
        mockSwapXPair.setAmountOut(0.5 ether);

        vm.prank(address(oethVault));
        vm.expectRevert("price out of range");
        oethSupernovaAMOStrategy.deposit(address(mockWeth), 1 ether);
    }
}
