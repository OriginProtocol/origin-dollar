// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SonicStakingStrategy_Shared_Test} from "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_SonicStakingStrategy_Undelegate_Test is Unit_SonicStakingStrategy_Shared_Test {
    function testFuzz_undelegate_tracksPendingWithdrawals(uint256 amount) public {
        amount = bound(amount, 1e15, 100_000 ether);

        _depositAsVault(amount);

        uint256 pendingBefore = sonicStakingStrategy.pendingWithdrawals();

        vm.prank(strategist);
        sonicStakingStrategy.undelegate(18, amount);

        assertEq(
            sonicStakingStrategy.pendingWithdrawals(),
            pendingBefore + amount,
            "pendingWithdrawals should increase by undelegated amount"
        );

        // SFC delegation should be reduced
        uint256 stakedAfter = mockSfc.getStake(address(sonicStakingStrategy), 18);
        assertEq(stakedAfter, 0, "SFC delegation should be 0 after full undelegate");
    }
}
