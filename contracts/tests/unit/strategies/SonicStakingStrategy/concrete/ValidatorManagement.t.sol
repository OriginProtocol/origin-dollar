// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";
import {SonicValidatorDelegator} from "contracts/strategies/sonic/SonicValidatorDelegator.sol";

contract Unit_Concrete_SonicStakingStrategy_ValidatorManagement_Test is Unit_SonicStakingStrategy_Shared_Test {
    function test_supportValidator() public {
        vm.prank(governor);
        sonicStakingStrategy.supportValidator(42);

        assertTrue(sonicStakingStrategy.isSupportedValidator(42));
    }

    function test_unsupportValidator() public {
        vm.prank(governor);
        sonicStakingStrategy.supportValidator(42);

        vm.prank(governor);
        sonicStakingStrategy.unsupportValidator(42);

        assertFalse(sonicStakingStrategy.isSupportedValidator(42));
    }

    function test_unsupportValidator_undelegatesIfStaked() public {
        // Deposit to validator 18 (default)
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        uint256 stakedBefore = mockSfc.getStake(address(sonicStakingStrategy), 18);
        assertEq(stakedBefore, amount);

        uint256 pendingBefore = sonicStakingStrategy.pendingWithdrawals();

        vm.prank(governor);
        sonicStakingStrategy.unsupportValidator(18);

        // Stake should be 0 after unsupport (undelegated)
        uint256 stakedAfter = mockSfc.getStake(address(sonicStakingStrategy), 18);
        assertEq(stakedAfter, 0);

        // Pending withdrawals should increase
        assertEq(sonicStakingStrategy.pendingWithdrawals(), pendingBefore + amount);
    }

    function test_setDefaultValidatorId() public {
        vm.prank(governor);
        sonicStakingStrategy.supportValidator(42);

        vm.prank(strategist);
        sonicStakingStrategy.setDefaultValidatorId(42);

        assertEq(sonicStakingStrategy.defaultValidatorId(), 42);
    }

    function test_setRegistrator() public {
        vm.prank(governor);
        sonicStakingStrategy.setRegistrator(bobby);

        assertEq(sonicStakingStrategy.validatorRegistrator(), bobby);
    }

    function test_supportValidator_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit SonicValidatorDelegator.SupportedValidator(42);

        vm.prank(governor);
        sonicStakingStrategy.supportValidator(42);
    }

    function test_unsupportValidator_emitsEvent() public {
        vm.prank(governor);
        sonicStakingStrategy.supportValidator(42);

        vm.expectEmit(true, false, false, true);
        emit SonicValidatorDelegator.UnsupportedValidator(42);

        vm.prank(governor);
        sonicStakingStrategy.unsupportValidator(42);
    }

    function test_setDefaultValidatorId_emitsEvent() public {
        vm.prank(governor);
        sonicStakingStrategy.supportValidator(42);

        vm.expectEmit(true, false, false, true);
        emit SonicValidatorDelegator.DefaultValidatorIdChanged(42);

        vm.prank(strategist);
        sonicStakingStrategy.setDefaultValidatorId(42);
    }

    function test_setRegistrator_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit SonicValidatorDelegator.RegistratorChanged(bobby);

        vm.prank(governor);
        sonicStakingStrategy.setRegistrator(bobby);
    }

    function test_supportValidator_RevertWhen_alreadySupported() public {
        vm.prank(governor);
        vm.expectRevert("Validator already supported");
        sonicStakingStrategy.supportValidator(18); // 18 is already supported
    }

    function test_unsupportValidator_RevertWhen_notSupported() public {
        vm.prank(governor);
        vm.expectRevert("Validator not supported");
        sonicStakingStrategy.unsupportValidator(99);
    }

    function test_setDefaultValidatorId_RevertWhen_notSupported() public {
        vm.prank(strategist);
        vm.expectRevert("Validator not supported");
        sonicStakingStrategy.setDefaultValidatorId(99);
    }

    function test_supportValidator_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        sonicStakingStrategy.supportValidator(42);
    }

    function test_setRegistrator_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        sonicStakingStrategy.setRegistrator(bobby);
    }
}
