// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from
    "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Unit_Concrete_SonicStakingStrategy_DisabledFunctions_Test is Unit_SonicStakingStrategy_Shared_Test {
    function test_setPTokenAddress_reverts() public {
        vm.prank(governor);
        vm.expectRevert("unsupported function");
        sonicStakingStrategy.setPTokenAddress(address(mockWrappedSonic), address(mockSfc));
    }

    function test_collectRewardTokens_reverts() public {
        vm.expectRevert("unsupported function");
        sonicStakingStrategy.collectRewardTokens();
    }

    function test_removePToken_reverts() public {
        vm.prank(governor);
        vm.expectRevert("unsupported function");
        sonicStakingStrategy.removePToken(0);
    }

    function test_safeApproveAllTokens_noOp() public {
        // Should not revert when called by governor
        vm.prank(governor);
        sonicStakingStrategy.safeApproveAllTokens();
    }
}
