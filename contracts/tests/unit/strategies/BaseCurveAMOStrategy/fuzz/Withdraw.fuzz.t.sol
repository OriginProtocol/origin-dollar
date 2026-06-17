// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BaseCurveAMOStrategy_Shared_Test} from "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_BaseCurveAMOStrategy_Withdraw_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    /// @notice Deposit then partial withdraw: recipient gets exact requested amount
    function testFuzz_withdraw_correctAmount(uint128 depositAmount, uint128 withdrawPct) public {
        vm.assume(depositAmount >= 1 ether && depositAmount <= 100_000 ether);
        withdrawPct = uint128(bound(withdrawPct, 1, 50));

        _seedVaultForSolvency(uint256(depositAmount) * 10 + 1_000_000 ether);
        _depositAsVault(depositAmount);

        uint256 withdrawAmount = (uint256(depositAmount) * withdrawPct) / 100;
        if (withdrawAmount == 0) return;

        address recipient = address(oethVault);
        uint256 recipientBalBefore = weth.balanceOf(recipient);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.withdraw(recipient, address(weth), withdrawAmount);

        assertEq(weth.balanceOf(recipient) - recipientBalBefore, withdrawAmount);
    }
}
