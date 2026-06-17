// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_Deposit_Test is Unit_CompoundingStakingSSVStrategy_Shared_Test {
    function test_deposit() public {
        uint256 amount = 10 ether;
        vm.prank(josh);
        weth.transfer(address(compoundingStakingSSVStrategy), amount);

        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.deposit(address(mockWeth), amount);

        assertEq(compoundingStakingSSVStrategy.depositedWethAccountedFor(), amount);
    }

    function test_deposit_RevertWhen_notVault() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Vault");
        compoundingStakingSSVStrategy.deposit(address(mockWeth), 1 ether);
    }

    function test_deposit_RevertWhen_wrongAsset() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Unsupported asset");
        compoundingStakingSSVStrategy.deposit(address(mockSsv), 1 ether);
    }

    function test_deposit_RevertWhen_zeroAmount() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Must deposit something");
        compoundingStakingSSVStrategy.deposit(address(mockWeth), 0);
    }

    function test_depositAll() public {
        uint256 amount = 5 ether;
        vm.prank(josh);
        weth.transfer(address(compoundingStakingSSVStrategy), amount);

        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.depositAll();

        assertEq(compoundingStakingSSVStrategy.depositedWethAccountedFor(), amount);
    }

    function test_depositAll_withPriorDeposit() public {
        // First deposit
        _depositToStrategy(3 ether);
        assertEq(compoundingStakingSSVStrategy.depositedWethAccountedFor(), 3 ether);

        // Transfer more WETH directly
        vm.prank(josh);
        weth.transfer(address(compoundingStakingSSVStrategy), 2 ether);

        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.depositAll();

        assertEq(compoundingStakingSSVStrategy.depositedWethAccountedFor(), 5 ether);
    }

    function test_depositAll_noNewDeposit() public {
        _depositToStrategy(3 ether);

        // depositAll with no new WETH should not emit or change anything
        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.depositAll();

        assertEq(compoundingStakingSSVStrategy.depositedWethAccountedFor(), 3 ether);
    }

    function test_depositAll_RevertWhen_notVault() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Vault");
        compoundingStakingSSVStrategy.depositAll();
    }
}
