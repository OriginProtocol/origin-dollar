// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

enum CompoundingValidatorState {
    NON_REGISTERED,
    REGISTERED,
    STAKED,
    VERIFIED,
    ACTIVE,
    EXITING,
    EXITED,
    REMOVED,
    INVALID
}

struct CompoundingValidatorStakeData {
    bytes pubkey;
    bytes signature;
    bytes32 depositDataRoot;
}

struct CompoundingFirstPendingDepositSlotProofData {
    uint64 slot;
    bytes proof;
}

struct CompoundingStrategyValidatorProofData {
    uint64 withdrawableEpoch;
    bytes withdrawableEpochProof;
}

struct CompoundingBalanceProofs {
    bytes32 balancesContainerRoot;
    bytes balancesContainerProof;
    bytes32[] validatorBalanceLeaves;
    bytes[] validatorBalanceProofs;
}

struct CompoundingPendingDepositProofs {
    bytes32 pendingDepositContainerRoot;
    bytes pendingDepositContainerProof;
    uint32[] pendingDepositIndexes;
    bytes[] pendingDepositProofs;
}
