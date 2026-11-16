// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofsLib } from "./BeaconProofsLib.sol";
import { IBeaconProofs } from "../interfaces/IBeaconProofs.sol";

/**
 * @title Fork-aware beacon proof verifier router.
 * @author Origin Protocol Inc
 */
contract BeaconProofsForkRouter is IBeaconProofs {
    /// @notice Verifier for the legacy Electra/Fulu proof format.
    address public immutable LEGACY_BEACON_PROOFS;
    /// @notice Verifier for the Gloas progressive SSZ proof format.
    address public immutable GLOAS_BEACON_PROOFS;
    /// @notice Unix timestamp from which Gloas is tried first; zero always prefers legacy.
    uint256 public immutable GLAMSTERDAM_ACTIVATION_TIMESTAMP;

    /// @notice Configures the legacy and Gloas verifiers and their preferred order.
    /// @dev Every verification retries the other verifier if the preferred verifier reverts.
    /// This permits historical roots across the fork boundary; the timestamp does not restrict accepted formats.
    /// @param legacyBeaconProofs Nonzero address of the legacy verifier.
    /// @param gloasBeaconProofs Nonzero address of the Gloas verifier.
    /// @param glamsterdamActivationTimestamp Unix timestamp to prefer Gloas, or zero to prefer legacy.
    constructor(
        address legacyBeaconProofs,
        address gloasBeaconProofs,
        uint256 glamsterdamActivationTimestamp
    ) {
        require(legacyBeaconProofs != address(0), "Invalid legacy proofs");
        require(gloasBeaconProofs != address(0), "Invalid gloas proofs");

        LEGACY_BEACON_PROOFS = legacyBeaconProofs;
        GLOAS_BEACON_PROOFS = gloasBeaconProofs;
        GLAMSTERDAM_ACTIVATION_TIMESTAMP = glamsterdamActivationTimestamp;
    }

    /// @inheritdoc IBeaconProofs
    function verifyValidator(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata validatorPubKeyProof,
        uint40 validatorIndex,
        bytes32 withdrawalCredentials
    ) external view {
        bytes memory data = abi.encodeCall(
            IBeaconProofs.verifyValidator,
            (
                beaconBlockRoot,
                pubKeyHash,
                validatorPubKeyProof,
                validatorIndex,
                withdrawalCredentials
            )
        );
        _verify(data);
    }

    /// @inheritdoc IBeaconProofs
    function verifyValidatorWithdrawable(
        bytes32 beaconBlockRoot,
        uint40 validatorIndex,
        uint64 withdrawableEpoch,
        bytes calldata withdrawableEpochProof
    ) external view {
        bytes memory data = abi.encodeCall(
            IBeaconProofs.verifyValidatorWithdrawable,
            (
                beaconBlockRoot,
                validatorIndex,
                withdrawableEpoch,
                withdrawableEpochProof
            )
        );
        _verify(data);
    }

    /// @inheritdoc IBeaconProofs
    function verifyBalancesContainer(
        bytes32 beaconBlockRoot,
        bytes32 balancesContainerLeaf,
        bytes calldata balancesContainerProof
    ) external view {
        bytes memory data = abi.encodeCall(
            IBeaconProofs.verifyBalancesContainer,
            (beaconBlockRoot, balancesContainerLeaf, balancesContainerProof)
        );
        _verify(data);
    }

    /// @inheritdoc IBeaconProofs
    function verifyValidatorBalance(
        bytes32 balancesContainerRoot,
        bytes32 validatorBalanceLeaf,
        bytes calldata balanceProof,
        uint40 validatorIndex
    ) external view returns (uint256 validatorBalance) {
        bytes memory data = abi.encodeCall(
            IBeaconProofs.verifyValidatorBalance,
            (
                balancesContainerRoot,
                validatorBalanceLeaf,
                balanceProof,
                validatorIndex
            )
        );
        bytes memory result = _verify(data);
        validatorBalance = abi.decode(result, (uint256));
    }

    /// @inheritdoc IBeaconProofs
    function verifyPendingDepositsContainer(
        bytes32 beaconBlockRoot,
        bytes32 pendingDepositsContainerRoot,
        bytes calldata proof
    ) external view {
        bytes memory data = abi.encodeCall(
            IBeaconProofs.verifyPendingDepositsContainer,
            (beaconBlockRoot, pendingDepositsContainerRoot, proof)
        );
        _verify(data);
    }

    /// @inheritdoc IBeaconProofs
    function verifyPendingDeposit(
        bytes32 pendingDepositsContainerRoot,
        bytes32 pendingDepositRoot,
        bytes calldata proof,
        uint32 pendingDepositIndex
    ) external view {
        bytes memory data = abi.encodeCall(
            IBeaconProofs.verifyPendingDeposit,
            (
                pendingDepositsContainerRoot,
                pendingDepositRoot,
                proof,
                pendingDepositIndex
            )
        );
        _verify(data);
    }

    /// @inheritdoc IBeaconProofs
    function verifyFirstPendingDeposit(
        bytes32 beaconBlockRoot,
        uint64 slot,
        bytes calldata firstPendingDepositSlotProof
    ) external view returns (bool isEmptyDepositQueue) {
        bytes memory data = abi.encodeCall(
            IBeaconProofs.verifyFirstPendingDeposit,
            (beaconBlockRoot, slot, firstPendingDepositSlotProof)
        );
        bytes memory result = _verify(data);
        isEmptyDepositQueue = abi.decode(result, (bool));
    }

    /// @inheritdoc IBeaconProofs
    function merkleizePendingDeposit(
        bytes32 pubKeyHash,
        bytes calldata withdrawalCredentials,
        uint64 amountGwei,
        bytes calldata signature,
        uint64 slot
    ) external pure returns (bytes32 root) {
        return
            BeaconProofsLib.merkleizePendingDeposit(
                pubKeyHash,
                withdrawalCredentials,
                amountGwei,
                signature,
                slot
            );
    }

    /// @inheritdoc IBeaconProofs
    function merkleizeSignature(bytes calldata signature)
        external
        pure
        returns (bytes32 root)
    {
        return BeaconProofsLib.merkleizeSignature(signature);
    }

    /// @notice Executes a proof-verification call, retrying the other verifier if the preferred one reverts.
    /// @dev Uses staticcall so neither verifier can modify state. Returns the first successful call's
    /// raw return data. If both calls revert, bubbles the fallback verifier's revert data, or uses
    /// a generic verification error when that data is empty. The preferred verifier's error is discarded.
    /// @param data ABI-encoded IBeaconProofs function selector and arguments.
    /// @return Raw ABI-encoded return data from the first successful verifier call.
    function _verify(bytes memory data) internal view returns (bytes memory) {
        (address primary, address fallbackVerifier) = _preferredVerifiers();

        (bool success, bytes memory result) = primary.staticcall(data);
        if (success) {
            return result;
        }

        (success, result) = fallbackVerifier.staticcall(data);
        _requireSuccess(success, result);
        return result;
    }

    /// @notice Selects the order in which the legacy and Gloas verifiers are tried.
    /// @dev Prefers Gloas when the configured activation timestamp is nonzero and has been reached;
    /// otherwise prefers legacy. This uses the current execution block's timestamp, not the timestamp
    /// of the beacon root being proven. Both formats remain accepted through fallback, including
    /// historical pre-fork roots after activation. A zero activation timestamp always prefers legacy.
    /// @return primary Verifier to call first.
    /// @return fallbackVerifier Verifier to call if the primary call reverts.
    function _preferredVerifiers()
        internal
        view
        returns (address primary, address fallbackVerifier)
    {
        if (
            GLAMSTERDAM_ACTIVATION_TIMESTAMP != 0 &&
            block.timestamp >= GLAMSTERDAM_ACTIVATION_TIMESTAMP
        ) {
            return (GLOAS_BEACON_PROOFS, LEGACY_BEACON_PROOFS);
        }

        return (LEGACY_BEACON_PROOFS, GLOAS_BEACON_PROOFS);
    }

    function _requireSuccess(bool success, bytes memory result) internal pure {
        if (success) {
            return;
        }

        if (result.length == 0) {
            revert("Beacon proof verification failed");
        }

        assembly {
            revert(add(result, 32), mload(result))
        }
    }
}
