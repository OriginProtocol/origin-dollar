// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_AutoWithdrawalModule_Shared_Test} from "tests/unit/automation/AutoWithdrawalModule/shared/Shared.t.sol";

contract Unit_Fuzz_AutoWithdrawalModule_FundWithdrawals_Test is Unit_AutoWithdrawalModule_Shared_Test {
    /// @notice Property: toWithdraw == min(shortfall, strategyBalance)
    ///         When both shortfall and strategyBalance are > 0, the vault
    ///         should record lastWithdrawAmount == min(shortfall, strategyBalance).
    function testFuzz_fundWithdrawals_withdrawsMinOfShortfallAndStrategyBalance(
        uint128 queued,
        uint128 claimable,
        uint256 strategyBalance
    ) public {
        // Ensure queued >= claimable to avoid underflow
        queued = uint128(bound(queued, 0, type(uint128).max));
        claimable = uint128(bound(claimable, 0, queued));
        strategyBalance = bound(strategyBalance, 0, type(uint128).max);

        uint256 shortfall = uint256(queued) - uint256(claimable);

        // Set mock state
        mockVault.setQueueMetadata(queued, claimable);
        mockStrategy.setNextBalance(strategyBalance);

        // Call fundWithdrawals as operator
        vm.prank(operator);
        autoWithdrawalModule.fundWithdrawals();

        uint256 expectedWithdraw = shortfall < strategyBalance ? shortfall : strategyBalance;

        if (expectedWithdraw == 0) {
            // No withdrawal should have been attempted
            assertFalse(mockVault.withdrawFromStrategyCalled());
        } else {
            assertTrue(mockVault.withdrawFromStrategyCalled());
            assertEq(mockVault.lastWithdrawAmount(), expectedWithdraw);
        }
    }
}
