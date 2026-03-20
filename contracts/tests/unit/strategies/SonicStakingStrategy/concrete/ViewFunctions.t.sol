// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Unit_Concrete_SonicStakingStrategy_ViewFunctions_Test is Unit_SonicStakingStrategy_Shared_Test {
    function test_supportsAsset_trueForWS() public view {
        assertTrue(sonicStakingStrategy.supportsAsset(address(mockWrappedSonic)));
    }

    function test_supportsAsset_falseForOther() public view {
        assertFalse(sonicStakingStrategy.supportsAsset(address(oSonic)));
        assertFalse(sonicStakingStrategy.supportsAsset(alice));
        assertFalse(sonicStakingStrategy.supportsAsset(address(0)));
    }

    function test_supportedValidatorsLength_returnsCorrectCount() public view {
        // setUp supports validator 18
        assertEq(sonicStakingStrategy.supportedValidatorsLength(), 1);
    }

    function test_supportedValidatorsLength_afterAddingValidators() public {
        vm.startPrank(governor);
        sonicStakingStrategy.supportValidator(19);
        sonicStakingStrategy.supportValidator(20);
        vm.stopPrank();

        assertEq(sonicStakingStrategy.supportedValidatorsLength(), 3);
    }

    function test_isWithdrawnFromSFC_falseForPendingWithdrawal() public {
        _depositAsVault(10 ether);

        vm.prank(strategist);
        uint256 withdrawId = sonicStakingStrategy.undelegate(18, 10 ether);

        assertFalse(sonicStakingStrategy.isWithdrawnFromSFC(withdrawId));
    }

    function test_isWithdrawnFromSFC_trueAfterWithdrawal() public {
        _depositAsVault(10 ether);

        vm.prank(strategist);
        uint256 withdrawId = sonicStakingStrategy.undelegate(18, 10 ether);

        mockSfc.slashValidator(18, 1e18);
        vm.deal(address(mockSfc), 10 ether);

        vm.prank(strategist);
        sonicStakingStrategy.withdrawFromSFC(withdrawId);

        assertTrue(sonicStakingStrategy.isWithdrawnFromSFC(withdrawId));
    }

    function test_isWithdrawnFromSFC_RevertWhen_invalidWithdrawId() public {
        // withdrawId 0 was never created, so validatorId == 0
        vm.expectRevert("Invalid withdrawId");
        sonicStakingStrategy.isWithdrawnFromSFC(0);
    }
}
