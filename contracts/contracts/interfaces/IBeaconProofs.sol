// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IBeaconProofs {
    function verifyValidator(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata validatorPubKeyProof,
        uint64 validatorIndex,
        address withdrawalAddress
    ) external view;

    function verifyValidatorWithdrawable(
        bytes32 beaconBlockRoot,
        uint64 validatorIndex,
        bytes32 pubKeyHash,
        uint64 withdrawableEpoch,
        bytes calldata withdrawableEpochProof,
        bytes calldata validatorPubKeyProof
    ) external view;

    function verifyValidatorWithdrawable(
        bytes32 beaconBlockRoot,
        uint64 validatorIndex,
        uint64 withdrawableEpoch,
        bytes calldata withdrawableEpochProof
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
        bytes32 pubKeyHash,
        bytes calldata firstPendingDepositPubKeyProof
    ) external view returns (bool isEmptyDepositQueue);

    function verifyFirstPendingDeposit(
        bytes32 beaconBlockRoot,
        uint64 slot,
        bytes calldata firstPendingDepositSlotProof
    ) external view returns (bool isEmptyDepositQueue);
}
