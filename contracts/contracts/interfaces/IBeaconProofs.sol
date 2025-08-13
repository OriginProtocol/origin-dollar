// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IBeaconProofs {
    enum BalanceProofLevel {
        Container,
        BeaconBlock
    }

    function verifyState(
        bytes32 beaconBlockRoot,
        bytes32 stateRoot,
        bytes calldata stateProof
    ) external view;

    function verifyValidator(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata validatorPubKeyProof,
        uint64 validatorIndex,
        address withdrawalAddress
    ) external view;

    function verifyBalancesContainer(
        bytes32 stateRoot,
        bytes32 balancesContainerLeaf,
        bytes calldata balancesContainerProof
    ) external view;

    function verifyValidatorBalance(
        bytes32 balancesContainerRoot,
        bytes32 validatorBalanceLeaf,
        bytes calldata balanceProof,
        uint64 validatorIndex
    ) external view returns (uint256 validatorBalance);

    struct VerifyFirstPendingDeposit {
        bytes32 stateRoot;
        bytes32 pubKeyHash;
        uint64 validatorIndex;
        uint64 slot;
        bytes32 firstPendingDepositRoot;
        bytes firstPendingDepositProof;
        bytes pendingDepositSlotProof;
        bytes pendingDepositPubKeyProof;
        bytes32 validatorsRoot;
        bytes validatorsProof;
        bytes validatorPubKeyProof;
        bytes validatorExitProof;
    }

    function verifyFirstPendingDeposit(
        VerifyFirstPendingDeposit calldata params
    ) external view returns (bool isEmptyDepositQueue);

    function verifyBlockNumber(
        bytes32 beaconBlockRoot,
        uint256 blockNumber,
        bytes calldata blockNumberProof
    ) external view;

    function verifySlot(
        bytes32 beaconBlockRoot,
        uint256 slot,
        bytes calldata slotProof
    ) external view;

    function balanceAtIndex(bytes32 validatorBalanceLeaf, uint64 validatorIndex)
        external
        pure
        returns (uint256);

    function concatGenIndices(
        uint256 genIndex,
        uint256 height,
        uint256 index
    ) external pure returns (uint256);
}
