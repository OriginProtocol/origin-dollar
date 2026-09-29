// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofsGloasLib } from "./BeaconProofsGloasLib.sol";
import { BeaconProofsLib } from "./BeaconProofsLib.sol";
import { IBeaconProofs } from "../interfaces/IBeaconProofs.sol";

/**
 * @title Verifies Glamsterdam/Gloas merkle proofs of beacon chain data.
 * @author Origin Protocol Inc
 */
contract BeaconProofsGloas is IBeaconProofs {
    function verifyValidator(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata proof,
        uint40 validatorIndex,
        bytes32 withdrawalCredentials
    ) external view {
        BeaconProofsGloasLib.verifyValidator(
            beaconBlockRoot,
            pubKeyHash,
            proof,
            validatorIndex,
            withdrawalCredentials
        );
    }

    function verifyValidatorWithdrawable(
        bytes32 beaconBlockRoot,
        uint40 validatorIndex,
        uint64 withdrawableEpoch,
        bytes calldata withdrawableEpochProof
    ) external view {
        BeaconProofsGloasLib.verifyValidatorWithdrawableEpoch(
            beaconBlockRoot,
            validatorIndex,
            withdrawableEpoch,
            withdrawableEpochProof
        );
    }

    function verifyBalancesContainer(
        bytes32 beaconBlockRoot,
        bytes32 balancesContainerRoot,
        bytes calldata balancesContainerProof
    ) external view {
        BeaconProofsGloasLib.verifyBalancesContainer(
            beaconBlockRoot,
            balancesContainerRoot,
            balancesContainerProof
        );
    }

    function verifyValidatorBalance(
        bytes32 balancesContainerRoot,
        bytes32 validatorBalanceLeaf,
        bytes calldata balanceProof,
        uint40 validatorIndex
    ) external view returns (uint256 validatorBalanceGwei) {
        validatorBalanceGwei = BeaconProofsGloasLib.verifyValidatorBalance(
            balancesContainerRoot,
            validatorBalanceLeaf,
            balanceProof,
            validatorIndex
        );
    }

    function verifyPendingDepositsContainer(
        bytes32 beaconBlockRoot,
        bytes32 pendingDepositsContainerRoot,
        bytes calldata proof
    ) external view {
        BeaconProofsGloasLib.verifyPendingDepositsContainer(
            beaconBlockRoot,
            pendingDepositsContainerRoot,
            proof
        );
    }

    function verifyPendingDeposit(
        bytes32 pendingDepositsContainerRoot,
        bytes32 pendingDepositRoot,
        bytes calldata proof,
        uint32 pendingDepositIndex
    ) external view {
        BeaconProofsGloasLib.verifyPendingDeposit(
            pendingDepositsContainerRoot,
            pendingDepositRoot,
            proof,
            pendingDepositIndex
        );
    }

    function verifyFirstPendingDeposit(
        bytes32 beaconBlockRoot,
        uint64 slot,
        bytes calldata firstPendingDepositSlotProof
    ) external view returns (bool isEmptyDepositQueue) {
        isEmptyDepositQueue = BeaconProofsGloasLib.verifyFirstPendingDeposit(
            beaconBlockRoot,
            slot,
            firstPendingDepositSlotProof
        );
    }

    function merkleizePendingDeposit(
        bytes32 pubKeyHash,
        bytes calldata withdrawalCredentials,
        uint64 amountGwei,
        bytes calldata signature,
        uint64 slot
    ) external pure returns (bytes32) {
        return
            BeaconProofsLib.merkleizePendingDeposit(
                pubKeyHash,
                withdrawalCredentials,
                amountGwei,
                signature,
                slot
            );
    }

    function merkleizeSignature(bytes calldata signature)
        external
        pure
        returns (bytes32 root)
    {
        return BeaconProofsLib.merkleizeSignature(signature);
    }
}
