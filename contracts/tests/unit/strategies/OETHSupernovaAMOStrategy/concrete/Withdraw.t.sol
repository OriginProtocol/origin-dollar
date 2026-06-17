// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {IOETHSupernovaAMOStrategy} from "contracts/interfaces/strategies/IOETHSupernovaAMOStrategy.sol";

contract Unit_Concrete_OETHSupernovaAMOStrategy_Withdraw_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    function test_withdraw_removesLPAndTransfersWETH() public {
        uint256 depositAmount = 10 ether;
        uint256 withdrawAmount = 5 ether;
        _seedVaultForSolvency(100 ether);
        _depositAsVault(depositAmount);

        uint256 vaultBalBefore = IERC20(address(mockWeth)).balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdraw(address(oethVault), address(mockWeth), withdrawAmount);

        assertEq(IERC20(address(mockWeth)).balanceOf(address(oethVault)) - vaultBalBefore, withdrawAmount);
    }

    function test_withdraw_burnsOETH() public {
        uint256 depositAmount = 10 ether;
        uint256 withdrawAmount = 5 ether;
        _seedVaultForSolvency(100 ether);
        _depositAsVault(depositAmount);

        uint256 supplyBefore = oeth.totalSupply();

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdraw(address(oethVault), address(mockWeth), withdrawAmount);

        // OETH should have been burned
        assertLt(oeth.totalSupply(), supplyBefore);
    }

    function test_withdraw_emitsWithdrawalEvents() public {
        uint256 depositAmount = 10 ether;
        uint256 withdrawAmount = 5 ether;
        _seedVaultForSolvency(100 ether);
        _depositAsVault(depositAmount);

        vm.expectEmit(true, true, true, true);
        emit IOETHSupernovaAMOStrategy.Withdrawal(address(mockWeth), address(mockSwapXPair), withdrawAmount);

        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.withdraw(address(oethVault), address(mockWeth), withdrawAmount);
    }

    function test_withdraw_RevertWhen_zeroAmount() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Must withdraw something");
        oethSupernovaAMOStrategy.withdraw(address(oethVault), address(mockWeth), 0);
    }

    function test_withdraw_RevertWhen_wrongAsset() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Unsupported asset");
        oethSupernovaAMOStrategy.withdraw(address(oethVault), address(oeth), 1 ether);
    }

    function test_withdraw_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        oethSupernovaAMOStrategy.withdraw(address(oethVault), address(mockWeth), 1 ether);
    }

    function test_withdraw_RevertWhen_notWithdrawToVault() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.prank(address(oethVault));
        vm.expectRevert("Only withdraw to vault allowed");
        oethSupernovaAMOStrategy.withdraw(alice, address(mockWeth), 5 ether);
    }

    function test_withdraw_RevertWhen_insufficientLP() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(1 ether);

        // Try to withdraw far more than what's in the pool
        vm.prank(address(oethVault));
        vm.expectRevert("Not enough LP tokens in gauge");
        oethSupernovaAMOStrategy.withdraw(address(oethVault), address(mockWeth), 1_000_000 ether);
    }

    function test_withdraw_RevertWhen_protocolInsolvent() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Inflate supply to cause insolvency after withdraw
        vm.prank(address(oethVault));
        oeth.mint(alice, 10_000 ether);

        vm.prank(address(oethVault));
        vm.expectRevert("Protocol insolvent");
        oethSupernovaAMOStrategy.withdraw(address(oethVault), address(mockWeth), 5 ether);
    }

    function test_withdraw_RevertWhen_emptyPoolReserves() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Zero out WETH reserves (skim will transfer excess to strategy first)
        _setupPoolReserves(0, 100 ether);

        vm.prank(address(oethVault));
        vm.expectRevert("Empty pool");
        oethSupernovaAMOStrategy.withdraw(address(oethVault), address(mockWeth), 5 ether);
    }

    function test_withdraw_RevertWhen_notEnoughWETHRemoved() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Mock pool burn to return nothing (simulating edge case where pool
        // returns less WETH than expected)
        vm.mockCall(
            address(mockSwapXPair),
            abi.encodeWithSelector(bytes4(keccak256("burn(address)"))),
            abi.encode(uint256(0), uint256(0))
        );

        vm.prank(address(oethVault));
        vm.expectRevert("Not enough asset removed");
        oethSupernovaAMOStrategy.withdraw(address(oethVault), address(mockWeth), 5 ether);
    }
}
