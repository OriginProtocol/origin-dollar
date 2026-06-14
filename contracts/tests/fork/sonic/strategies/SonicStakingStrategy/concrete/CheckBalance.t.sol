// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_SonicStakingStrategy_Shared_Test
} from "tests/fork/sonic/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Fork_Concrete_SonicStakingStrategy_CheckBalance_Test is Fork_SonicStakingStrategy_Shared_Test {
    function test_checkBalance_notAffectedByRawS() public {
        uint256 sBalanceBefore = address(sonicStakingStrategy).balance;
        uint256 strategyBalance = sonicStakingStrategy.checkBalance(address(wrappedSonic));

        // Send raw S via wS.withdrawTo() — bypasses the receive() check
        vm.prank(clement);
        wrappedSonic.withdrawTo(address(sonicStakingStrategy), 100 ether);

        assertGt(address(sonicStakingStrategy).balance, sBalanceBefore, "S balance not increased");
        assertEq(
            sonicStakingStrategy.checkBalance(address(wrappedSonic)), strategyBalance, "checkBalance value changed"
        );
    }
}
