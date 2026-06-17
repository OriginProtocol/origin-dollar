// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_SonicStakingStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Smoke_Concrete_SonicStakingStrategy_Withdraw_Test is Smoke_SonicStakingStrategy_Shared_Test {
    function test_withdraw_transfersWSToRecipient() public {
        uint256 amount = 1_000 ether;

        // Deal wS directly to strategy (simulating lingering undelegated funds)
        deal(address(wrappedSonic), address(sonicStakingStrategy), amount);

        uint256 vaultBalanceBefore = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));

        vm.prank(address(oSonicVault));
        sonicStakingStrategy.withdraw(address(oSonicVault), address(wrappedSonic), amount);

        uint256 vaultBalanceAfter = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));
        assertEq(vaultBalanceAfter - vaultBalanceBefore, amount, "Vault should receive withdrawn wS");
    }

    function test_withdrawAll_transfersAllWSToVault() public {
        uint256 amount = 1_000 ether;

        // Deal wS directly to strategy
        deal(address(wrappedSonic), address(sonicStakingStrategy), amount);
        // Also deal native S to strategy
        vm.deal(address(sonicStakingStrategy), 500 ether);

        uint256 vaultBalanceBefore = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));

        vm.prank(address(oSonicVault));
        sonicStakingStrategy.withdrawAll();

        uint256 vaultBalanceAfter = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));
        assertEq(
            vaultBalanceAfter - vaultBalanceBefore, amount + 500 ether, "Vault should receive all wS + wrapped native S"
        );
    }
}
