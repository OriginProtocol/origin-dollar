// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingStrategy/shared/Shared.t.sol";

// --- Project imports
import {ICompoundingStakingStrategy} from "contracts/interfaces/strategies/ICompoundingStakingStrategy.sol";

contract Unit_Concrete_CompoundingStakingStrategy_Deposit_Test is Unit_CompoundingStakingStrategy_Shared_Test {
    function test_deposit() public {
        uint256 amount = 10 ether;
        vm.prank(josh);
        weth.transfer(address(compoundingStakingStrategy), amount);

        vm.prank(address(oethVault));
        compoundingStakingStrategy.deposit(address(mockWeth), amount);

        assertEq(compoundingStakingStrategy.depositedWethAccountedFor(), amount);
    }

    function test_deposit_RevertWhen_notVault() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Vault");
        compoundingStakingStrategy.deposit(address(mockWeth), 1 ether);
    }

    function test_deposit_RevertWhen_wrongAsset() public {
        vm.prank(address(oethVault));
        vm.expectRevert(ICompoundingStakingStrategy.UnsupportedAsset.selector);
        compoundingStakingStrategy.deposit(address(unsupportedToken), 1 ether);
    }

    function test_deposit_RevertWhen_zeroAmount() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Must deposit something");
        compoundingStakingStrategy.deposit(address(mockWeth), 0);
    }

    function test_depositAll() public {
        uint256 amount = 5 ether;
        vm.prank(josh);
        weth.transfer(address(compoundingStakingStrategy), amount);

        vm.prank(address(oethVault));
        compoundingStakingStrategy.depositAll();

        assertEq(compoundingStakingStrategy.depositedWethAccountedFor(), amount);
    }

    function test_depositAll_withPriorDeposit() public {
        // First deposit
        _depositToStrategy(3 ether);
        assertEq(compoundingStakingStrategy.depositedWethAccountedFor(), 3 ether);

        // Transfer more WETH directly
        vm.prank(josh);
        weth.transfer(address(compoundingStakingStrategy), 2 ether);

        vm.prank(address(oethVault));
        compoundingStakingStrategy.depositAll();

        assertEq(compoundingStakingStrategy.depositedWethAccountedFor(), 5 ether);
    }

    function test_depositAll_noNewDeposit() public {
        _depositToStrategy(3 ether);

        // depositAll with no new WETH should not emit or change anything
        vm.prank(address(oethVault));
        compoundingStakingStrategy.depositAll();

        assertEq(compoundingStakingStrategy.depositedWethAccountedFor(), 3 ether);
    }

    function test_depositAll_RevertWhen_notVault() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Vault");
        compoundingStakingStrategy.depositAll();
    }
}
