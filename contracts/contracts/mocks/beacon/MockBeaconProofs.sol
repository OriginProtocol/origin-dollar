// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IBeaconProofs } from "../../interfaces/IBeaconProofs.sol";

// solhint-disable no-unused-vars

/**
 * @title Mock contract for test purposes verifying Merkle proofs
 * @author Origin Protocol Inc
 */
contract MockBeaconProofs is IBeaconProofs {
    /// @dev Number of bytes in the proof to the first pending deposit.
    /// 37 witness hashes of 32 bytes each concatenated together.
    /// BeaconBlock.state.PendingDeposits[0]
    /// 37 * 32 bytes = 1184 bytes
    uint256 internal constant FIRST_PENDING_DEPOSIT_PROOF_LENGTH = 1184;

    uint256 internal constant DEFAULT_VALIDATOR_BALANCE = 32 ether;
    // mapping of validator indexes to validator balances
    mapping(uint40 => uint256) public validatorBalances;

    function setValidatorBalance(uint40 index, uint256 validatorBalance)
        external
    {
        // set special max value instead of 0
        if (validatorBalance == 0) {
            validatorBalances[index] = type(uint256).max;
        } else {
            validatorBalances[index] = validatorBalance;
        }
    }

    /// @notice Verifies the validator index is for the given validator public key.
    /// Also verify the validator's withdrawal credential points to the withdrawal address.
    /// BeaconBlock.state.validators[validatorIndex].pubkey
    /// @param beaconBlockRoot The root of the beacon block
    /// @param pubKeyHash Hash of validator's public key using the Beacon Chain's format
    /// @param proof The merkle proof for the validator public key to the beacon block root.
    /// This is 53 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    /// @param validatorIndex The validator index
    /// @param withdrawalAddress The withdrawal address used in the validator's withdrawal credentials
    function verifyValidator(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata proof,
        uint40 validatorIndex,
        address withdrawalAddress
    ) external view {
        // always pass
    }

    function verifyValidatorWithdrawable(
        bytes32 beaconBlockRoot,
        uint40 validatorIndex,
        uint64 withdrawableEpoch,
        bytes calldata withdrawableEpochProof
    ) external view {
        // always pass
    }

    /// @notice Verifies the balances container to the beacon block root
    /// BeaconBlock.state.balances
    /// @param beaconBlockRoot The root of the beacon block
    /// @param balancesContainerRoot The merkle root of the the balances container
    /// @param balancesContainerProof The merkle proof for the balances container to the beacon block root.
    /// This is 9 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    function verifyBalancesContainer(
        bytes32 beaconBlockRoot,
        bytes32 balancesContainerRoot,
        bytes calldata balancesContainerProof
    ) external view {
        // always pass
    }

    /// @notice Verifies the validator balance to the root of the Balances container.
    /// @param balancesContainerRoot The merkle root of the Balances container.
    /// @param validatorBalanceLeaf The leaf node containing the validator balance with three other balances.
    /// @param balanceProof The merkle proof for the validator balance to the Balances container root.
    /// This is 39 witness hashes of 32 bytes each concatenated together starting from the leaf node.
    /// @param validatorIndex The validator index to verify the balance for
    /// @return validatorBalanceGwei The balance in Gwei of the validator at the given index
    function verifyValidatorBalance(
        bytes32 balancesContainerRoot,
        bytes32 validatorBalanceLeaf,
        bytes calldata balanceProof,
        uint40 validatorIndex
    ) external view returns (uint256 validatorBalanceGwei) {
        uint256 validatorBalance = validatorBalances[validatorIndex];

        // special setting representing 0 balance
        if (validatorBalance == type(uint256).max) {
            return 0;
        }
        // validator balance not set by the test cases
        else if (validatorBalance == 0) {
            return DEFAULT_VALIDATOR_BALANCE;
        }

        return validatorBalance;
    }

    function verifyPendingDepositsContainer(
        bytes32 beaconBlockRoot,
        bytes32 pendingDepositsContainerRoot,
        bytes calldata proof
    ) external view {
        // always pass
    }

    function verifyPendingDeposit(
        bytes32 pendingDepositsContainerRoot,
        bytes32 pendingDepositRoot,
        bytes calldata proof,
        uint32 pendingDepositIndex
    ) external view {
        // always pass
    }

    /// @notice If the deposit queue is not empty,
    /// verify the slot of the first pending deposit to the beacon block root.
    /// BeaconBlock.state.pendingDeposits[0].slot
    /// If the deposit queue is empty, verify the root of the first pending deposit is empty
    /// BeaconBlock.state.PendingDeposits[0]
    /// @param beaconBlockRoot The root of the beacon block.
    /// @param slot The beacon chain slot of the first deposit in the beacon chain's deposit queue.
    /// Can be anything if the deposit queue is empty.
    /// @param firstPendingDepositSlotProof The merkle proof to the beacon block root. Can be either:
    /// - 40 witness hashes for BeaconBlock.state.PendingDeposits[0].slot when the deposit queue is not empty.
    /// - 37 witness hashes for BeaconBlock.state.PendingDeposits[0] when the deposit queue is empty.
    /// The 32 byte witness hashes are concatenated together starting from the leaf node.
    /// @return isEmptyDepositQueue True if the deposit queue is empty, false otherwise.
    function verifyFirstPendingDeposit(
        bytes32 beaconBlockRoot,
        uint64 slot,
        bytes calldata firstPendingDepositSlotProof
    ) external view returns (bool isEmptyDepositQueue) {
        if (
            firstPendingDepositSlotProof.length ==
            FIRST_PENDING_DEPOSIT_PROOF_LENGTH
        ) {
            isEmptyDepositQueue = true;
        }
    }

    function merkleizePendingDeposit(
        bytes32 pubKeyHash,
        bytes calldata withdrawalCredentials,
        uint64 amountGwei,
        bytes calldata signature,
        uint64 slot
    ) external pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    pubKeyHash,
                    withdrawalCredentials,
                    amountGwei,
                    signature,
                    slot
                )
            );
    }

    function merkleizeSignature(bytes calldata signature)
        external
        pure
        returns (bytes32 root)
    {
        return keccak256(abi.encodePacked(signature));
    }
}
