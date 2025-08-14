// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IBeaconProofs {
    enum BalanceProofLevel {
        Container,
        BeaconBlock
    }

    function verifyValidator(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata validatorPubKeyProof,
        uint64 validatorIndex,
        address withdrawalAddress
    ) external view;

    function verifyBalancesContainer(
        bytes32 beaconBlockRoot,
        bytes32 balancesContainerLeaf,
        bytes calldata balancesContainerProof
    ) external view;

    function verifyValidatorBalance(
        bytes32 balancesContainerRoot,
        bytes32 validatorBalanceLeaf,
        bytes calldata balanceProof,
        uint64 validatorIndex
    ) external view returns (uint256 validatorBalance);

    function verifyFirstPendingDeposit(
        bytes32 beaconBlockRoot,
        uint64 slot,
        bytes calldata firstPendingDepositSlotProof
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
