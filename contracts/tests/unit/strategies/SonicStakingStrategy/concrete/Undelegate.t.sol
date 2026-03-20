// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";
import {SonicValidatorDelegator} from "contracts/strategies/sonic/SonicValidatorDelegator.sol";

contract Unit_Concrete_SonicStakingStrategy_Undelegate_Test is Unit_SonicStakingStrategy_Shared_Test {
    function test_undelegate_createsRequest() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        vm.prank(strategist);
        uint256 withdrawId = sonicStakingStrategy.undelegate(18, amount);

        (uint256 validatorId, uint256 undelegatedAmount,) = sonicStakingStrategy.withdrawals(withdrawId);
        assertEq(validatorId, 18);
        assertEq(undelegatedAmount, amount);
    }

    function test_undelegate_incrementsWithdrawId() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        uint256 nextIdBefore = sonicStakingStrategy.nextWithdrawId();

        vm.prank(strategist);
        uint256 withdrawId = sonicStakingStrategy.undelegate(18, 5 ether);

        assertEq(withdrawId, nextIdBefore);
        assertEq(sonicStakingStrategy.nextWithdrawId(), nextIdBefore + 1);
    }

    function test_undelegate_increasesPendingWithdrawals() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        uint256 pendingBefore = sonicStakingStrategy.pendingWithdrawals();

        vm.prank(strategist);
        sonicStakingStrategy.undelegate(18, amount);

        assertEq(sonicStakingStrategy.pendingWithdrawals(), pendingBefore + amount);
    }

    function test_undelegate_emitsEvent() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        uint256 expectedWithdrawId = sonicStakingStrategy.nextWithdrawId();

        vm.expectEmit(true, true, false, true);
        emit SonicValidatorDelegator.Undelegated(expectedWithdrawId, 18, amount);

        vm.prank(strategist);
        sonicStakingStrategy.undelegate(18, amount);
    }

    function test_undelegate_RevertWhen_zeroAmount() public {
        _depositAsVault(10 ether);

        vm.prank(strategist);
        vm.expectRevert("Must undelegate something");
        sonicStakingStrategy.undelegate(18, 0);
    }

    function test_undelegate_RevertWhen_insufficientDelegation() public {
        _depositAsVault(10 ether);

        vm.prank(strategist);
        vm.expectRevert("Insufficient delegation");
        sonicStakingStrategy.undelegate(18, 20 ether);
    }

    function test_undelegate_RevertWhen_calledByNonRegistratorOrStrategist() public {
        _depositAsVault(10 ether);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Registrator or Strategist");
        sonicStakingStrategy.undelegate(18, 10 ether);
    }
}
