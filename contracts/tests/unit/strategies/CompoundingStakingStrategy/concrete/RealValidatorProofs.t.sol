// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {CompoundingValidatorState as ValidatorState} from "contracts/interfaces/strategies/CompoundingStakingTypes.sol";
import {
    Unit_CompoundingStakingStrategy_TwentyOneValidators_Shared_Test
} from "../shared/TwentyOneValidatorsShared.t.sol";

contract Unit_Concrete_CompoundingStakingStrategy_RealValidatorProofs_Test is
    Unit_CompoundingStakingStrategy_TwentyOneValidators_Shared_Test
{
    function _prepareTwentyOneValidators() internal override {}

    function _assertHistoricalCredentialMutationRejected(bytes32 mutatedCredentials) internal {
        bytes32 pendingDepositRoot = _stakeNewValidator(0);
        uint256 verifiedBalanceBefore = compoundingStakingStrategy.lastVerifiedEthBalance();
        (uint64 nextBlockTimestamp, bytes32 beaconBlockRoot, bytes memory proof) = _loadHistoricalValidatorProof(0);
        for (uint256 i = 0; i < 32; ++i) {
            proof[i] = mutatedCredentials[i];
        }

        mockBeaconRootsContract.setBeaconRoot(nextBlockTimestamp, beaconBlockRoot);
        vm.expectRevert("Invalid withdrawal cred");
        compoundingStakingStrategy.verifyValidator(
            nextBlockTimestamp,
            uint40(testValidators[0].index),
            testValidators[0].publicKeyHash,
            _withdrawalCredentialsBytes32(),
            proof
        );

        (ValidatorState state,) = compoundingStakingStrategy.validator(testValidators[0].publicKeyHash);
        assertEq(uint256(state), uint256(ValidatorState.STAKED));
        assertEq(compoundingStakingStrategy.verifiedValidatorsLength(), 0);
        assertEq(compoundingStakingStrategy.depositListLength(), 1);
        assertEq(compoundingStakingStrategy.depositList(0), pendingDepositRoot);
        assertEq(compoundingStakingStrategy.lastVerifiedEthBalance(), verifiedBalanceBefore);
        assertTrue(compoundingStakingStrategy.firstDeposit());
    }

    function test_verifyValidator_invalidCredentialTypeHistoricalProofLeavesStateUnchanged() public {
        bytes32 invalidType = bytes32(abi.encodePacked(bytes1(0x01), bytes11(0), address(compoundingStakingStrategy)));
        _assertHistoricalCredentialMutationRejected(invalidType);
    }

    function test_verifyValidator_nonZeroCredentialPaddingHistoricalProofLeavesStateUnchanged() public {
        bytes32 invalidPadding =
            bytes32(abi.encodePacked(bytes1(0x02), bytes1(0x01), bytes10(0), address(compoundingStakingStrategy)));
        _assertHistoricalCredentialMutationRejected(invalidPadding);
    }

    function test_verifyValidator_historicalProofPositiveControl() public {
        _stakeNewValidator(0);
        _verifyHistoricalValidatorProof(0, _withdrawalCredentialsBytes32());

        (ValidatorState state,) = compoundingStakingStrategy.validator(testValidators[0].publicKeyHash);
        assertEq(uint256(state), uint256(ValidatorState.VERIFIED));
        assertEq(compoundingStakingStrategy.verifiedValidatorsLength(), 1);
        assertEq(compoundingStakingStrategy.depositListLength(), 1);
    }
}
