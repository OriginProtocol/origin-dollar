// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from
    "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_SonicStakingStrategy_CheckBalance_Test is Unit_SonicStakingStrategy_Shared_Test {
    function testFuzz_checkBalance_includesAllComponents(
        uint256 wsBalance,
        uint256 staked,
        uint256 rewards
    ) public {
        wsBalance = bound(wsBalance, 0, 100_000 ether);
        staked = bound(staked, 0, 100_000 ether);
        rewards = bound(rewards, 0, 100_000 ether);

        // Set wS balance on strategy
        _mintWS(address(sonicStakingStrategy), wsBalance);

        // Deposit (stake) to SFC if staked > 0
        if (staked > 0) {
            _depositAsVault(staked);
        }

        // Set rewards on MockSFC
        mockSfc.setRewards(address(sonicStakingStrategy), 18, rewards);

        uint256 balance = sonicStakingStrategy.checkBalance(address(mockWrappedSonic));
        assertEq(balance, wsBalance + staked + rewards, "checkBalance should sum all components");
    }
}
