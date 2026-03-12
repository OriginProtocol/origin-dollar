// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_NativeStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_NativeStakingSSVStrategy_SSVOperations_Test is Unit_NativeStakingSSVStrategy_Shared_Test {
    function test_depositSSV_onlyStrategist() public {
        deal(address(mockSsv), address(nativeStakingSSVStrategy), 100 ether);

        vm.prank(strategist);
        nativeStakingSSVStrategy.depositSSV(_operatorIds(), 10 ether, _emptyCluster());
    }

    function test_depositSSV_RevertWhen_notStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist");
        nativeStakingSSVStrategy.depositSSV(_operatorIds(), 10 ether, _emptyCluster());
    }

    function test_withdrawSSV_onlyGovernor() public {
        vm.prank(governor);
        nativeStakingSSVStrategy.withdrawSSV(_operatorIds(), 10 ether, _emptyCluster());
    }

    function test_withdrawSSV_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        nativeStakingSSVStrategy.withdrawSSV(_operatorIds(), 10 ether, _emptyCluster());
    }

    function test_safeApproveAllTokens() public {
        nativeStakingSSVStrategy.safeApproveAllTokens();
        assertEq(mockSsv.allowance(address(nativeStakingSSVStrategy), address(mockSsvNetwork)), type(uint256).max);
    }
}
