// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_NativeStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_NativeStakingSSVStrategy_SSVOperations_Test is Unit_NativeStakingSSVStrategy_Shared_Test {
    function test_migrateClusterToETH_onlyGovernor() public {
        vm.prank(governor);
        nativeStakingSSVStrategy.migrateClusterToETH(_operatorIds(), _emptyCluster());
    }

    function test_migrateClusterToETH_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        nativeStakingSSVStrategy.migrateClusterToETH(_operatorIds(), _emptyCluster());
    }

    function test_safeApproveAllTokens() public {
        nativeStakingSSVStrategy.safeApproveAllTokens();
        assertEq(mockSsv.allowance(address(nativeStakingSSVStrategy), address(mockSsvNetwork)), type(uint256).max);
    }
}
