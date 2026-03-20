// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Smoke_ClaimStrategyRewardsSafeModule_Shared_Test
} from "tests/smoke/automation/ClaimStrategyRewardsSafeModule/shared/Shared.t.sol";
import {Vm} from "forge-std/Vm.sol";

contract Smoke_Concrete_ClaimStrategyRewardsSafeModule_Test is Smoke_ClaimStrategyRewardsSafeModule_Shared_Test {
    function test_safeContract() public view {
        assertNotEq(address(claimStrategyRewardsModule.safeContract()), address(0));
    }

    function test_strategies() public view {
        address firstStrategy = claimStrategyRewardsModule.strategies(0);
        assertNotEq(firstStrategy, address(0));
        assertTrue(claimStrategyRewardsModule.isStrategyWhitelisted(firstStrategy));
    }

    function test_claimRewards() public {
        bytes32 operatorRole = claimStrategyRewardsModule.OPERATOR_ROLE();
        address operator = claimStrategyRewardsModule.getRoleMember(operatorRole, 0);

        vm.recordLogs();

        vm.prank(operator);
        claimStrategyRewardsModule.claimRewards(true);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 failedSig = keccak256("ClaimRewardsFailed(address)");
        uint256 failCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == failedSig) failCount++;
        }
        assertEq(failCount, 0, "All strategy reward claims should succeed");
    }
}
