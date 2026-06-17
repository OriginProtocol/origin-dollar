// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SonicStakingStrategy_Shared_Test} from "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_SonicStakingStrategy_Deposit_Test is Unit_SonicStakingStrategy_Shared_Test {
    function testFuzz_deposit_delegatesCorrectAmount(uint256 amount) public {
        amount = bound(amount, 1e15, 100_000 ether);

        _depositAsVault(amount);

        uint256 staked = mockSfc.getStake(address(sonicStakingStrategy), 18);
        assertEq(staked, amount, "SFC delegation should match deposit amount");
    }
}
