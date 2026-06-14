// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Fuzz_SonicSwapXAMOStrategy_Withdraw_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    /// @notice Deposit then partial withdraw: vault receives exact requested wS amount
    function testFuzz_withdraw_vaultReceivesExactAmount(uint128 depositAmount, uint128 withdrawPct) public {
        vm.assume(depositAmount >= 1 ether && depositAmount <= 100_000 ether);
        // withdrawPct from 1 to 50 (percent)
        withdrawPct = uint128(bound(withdrawPct, 1, 50));

        _seedVaultForSolvency(uint256(depositAmount) * 10 + 1_000_000 ether);
        _depositAsVault(depositAmount);

        uint256 withdrawAmount = (uint256(depositAmount) * withdrawPct) / 100;
        if (withdrawAmount == 0) return;

        uint256 vaultBalBefore = IERC20(address(mockWrappedSonic)).balanceOf(address(oSonicVault));

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), address(mockWrappedSonic), withdrawAmount);

        assertEq(IERC20(address(mockWrappedSonic)).balanceOf(address(oSonicVault)) - vaultBalBefore, withdrawAmount);
    }
}
