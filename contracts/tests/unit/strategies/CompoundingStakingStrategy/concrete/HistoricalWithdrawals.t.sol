// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {CompoundingValidatorState as ValidatorState} from "contracts/interfaces/strategies/CompoundingStakingTypes.sol";
import {
    Unit_CompoundingStakingStrategy_TwentyOneValidators_Shared_Test
} from "../shared/TwentyOneValidatorsShared.t.sol";

contract Unit_Concrete_CompoundingStakingStrategy_HistoricalWithdrawals_Test is
    Unit_CompoundingStakingStrategy_TwentyOneValidators_Shared_Test
{
    function _prepareTwentyOneValidators() internal override {
        this.processHistoricalValidator(3);
    }

    function _withdrawalValidatorPositions() internal pure returns (uint256[] memory positions) {
        positions = new uint256[](1);
        positions[0] = 2;
    }

    function _requestPartialWithdrawal() internal {
        vm.deal(governor, 1 wei);
        vm.prank(governor);
        compoundingStakingStrategy.validatorWithdrawal{value: 1 wei}(
            testValidators[3].publicKey, uint64(640 ether / 1 gwei)
        );
    }

    function _requestFullWithdrawal() internal {
        vm.deal(governor, 1 wei);
        vm.prank(governor);
        compoundingStakingStrategy.validatorWithdrawal{value: 1 wei}(testValidators[3].publicKey, 0);
    }

    function _completeHistoricalPendingDeposits() internal {
        bytes32 firstRoot = compoundingStakingStrategy.depositList(0);
        bytes32 secondRoot = compoundingStakingStrategy.depositList(1);
        _verifyHistoricalDeposit(3, firstRoot);
        _verifyHistoricalDeposit(3, secondRoot);
    }

    function test_verifyBalances_zeroBalancePendingDepositsThenFinalExit() public {
        uint256[] memory validatorPositions = _withdrawalValidatorPositions();
        uint256 activeBalance = _applyHistoricalSnapshot(1, validatorPositions, 0, 0);
        this.topUpHistoricalValidator(3, 1 ether / 1 gwei);
        this.topUpHistoricalValidator(3, 2 ether / 1 gwei);

        uint256 receivedEth = 1588.918094377 ether;
        uint256 pendingBalance = _applyHistoricalSnapshot(2, validatorPositions, 3 ether, receivedEth);
        (ValidatorState retainedState,) = compoundingStakingStrategy.validator(testValidators[3].publicKeyHash);
        assertEq(pendingBalance, activeBalance + 3 ether);
        assertEq(compoundingStakingStrategy.depositListLength(), 2);
        assertEq(compoundingStakingStrategy.verifiedValidatorsLength(), 1);
        assertEq(uint256(retainedState), uint256(ValidatorState.ACTIVE));

        _completeHistoricalPendingDeposits();
        uint256 finalBalance = _applyHistoricalSnapshot(2, validatorPositions, 0, receivedEth);
        (ValidatorState exitedState,) = compoundingStakingStrategy.validator(testValidators[3].publicKeyHash);
        assertEq(finalBalance, activeBalance);
        assertEq(compoundingStakingStrategy.depositListLength(), 0);
        assertEq(compoundingStakingStrategy.verifiedValidatorsLength(), 0);
        assertEq(uint256(exitedState), uint256(ValidatorState.EXITED));
    }

    function test_verifyBalances_fullWithdrawal() public {
        uint256[] memory validatorPositions = _withdrawalValidatorPositions();
        uint256 beforeBalance = _applyHistoricalSnapshot(1, validatorPositions, 0, 0);
        _requestFullWithdrawal();

        (ValidatorState exitingState,) = compoundingStakingStrategy.validator(testValidators[3].publicKeyHash);
        assertEq(uint256(exitingState), uint256(ValidatorState.EXITING));

        uint256 afterBalance = _applyHistoricalSnapshot(2, validatorPositions, 0, 1588.918094377 ether);
        (ValidatorState exitedState,) = compoundingStakingStrategy.validator(testValidators[3].publicKeyHash);
        assertEq(afterBalance, beforeBalance);
        assertEq(uint256(exitedState), uint256(ValidatorState.EXITED));
        assertEq(compoundingStakingStrategy.verifiedValidatorsLength(), 0);
        assertFalse(_containsVerifiedValidator(testValidators[3].publicKeyHash));
    }

    function test_verifyBalances_processedPartialWithdrawal() public {
        uint256[] memory validatorPositions = _withdrawalValidatorPositions();
        uint256 beforeBalance = _applyHistoricalSnapshot(0, validatorPositions, 0, 0);
        _requestPartialWithdrawal();

        uint256 receivedEth = 639.401684364 ether;
        uint256 afterBalance = _applyHistoricalSnapshot(1, validatorPositions, 0, receivedEth);

        assertEq(afterBalance, beforeBalance);
        assertEq(compoundingStakingStrategy.lastVerifiedEthBalance(), beforeBalance);
        assertEq(compoundingStakingStrategy.checkBalance(address(mockWeth)), beforeBalance);
    }

    function test_verifyBalances_pendingPartialWithdrawal() public {
        uint256[] memory validatorPositions = _withdrawalValidatorPositions();
        uint256 beforeBalance = _applyHistoricalSnapshot(0, validatorPositions, 0, 0);
        _requestPartialWithdrawal();

        uint256 afterBalance = _applyHistoricalSnapshot(0, validatorPositions, 0, 0);
        (ValidatorState state,) = compoundingStakingStrategy.validator(testValidators[3].publicKeyHash);
        assertEq(afterBalance, beforeBalance);
        assertEq(uint256(state), uint256(ValidatorState.ACTIVE));
    }
}
