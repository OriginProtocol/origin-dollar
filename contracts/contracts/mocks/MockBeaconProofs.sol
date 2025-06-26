// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofs } from "../beacon/BeaconProofs.sol";

contract MockBeaconProofs {
    function generalizeIndex(BeaconProofs.TreeNode[] memory nodes)
        external
        pure
        returns (uint256 index)
    {
        return BeaconProofs.generalizeIndex(nodes);
    }

    function generalizeIndexSingle(uint256 height, uint256 index)
        external
        pure
        returns (uint256 genIndex)
    {
        return BeaconProofs.generalizeIndex(height, index);
    }

    function verifyValidatorPubkey(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata validatorPubKeyProof,
        uint64 validatorIndex
    ) external view {
        BeaconProofs.verifyValidatorPubkey(
            beaconBlockRoot,
            pubKeyHash,
            validatorPubKeyProof,
            validatorIndex
        );
    }

    function verifyBalancesContainer(
        bytes32 beaconBlockRoot,
        bytes32 balancesContainerLeaf,
        bytes calldata balancesContainerProof
    ) external view {
        BeaconProofs.verifyBalancesContainer(
            beaconBlockRoot,
            balancesContainerLeaf,
            balancesContainerProof
        );
    }

    function verifyValidatorBalanceInContainer(
        bytes32 balancesContainerRoot,
        bytes32 validatorBalanceLeaf,
        bytes calldata balanceProof,
        uint64 validatorIndex
    ) external view returns (uint256 validatorBalance) {
        return
            BeaconProofs.verifyValidatorBalance(
                balancesContainerRoot,
                validatorBalanceLeaf,
                balanceProof,
                validatorIndex,
                BeaconProofs.BalanceProofLevel.Container
            );
    }

    function verifyValidatorBalanceInBeaconBlock(
        bytes32 beaconBlockRoot,
        bytes32 validatorBalanceLeaf,
        bytes calldata balanceProof,
        uint64 validatorIndex
    ) external view returns (uint256 validatorBalance) {
        return
            BeaconProofs.verifyValidatorBalance(
                beaconBlockRoot,
                validatorBalanceLeaf,
                balanceProof,
                validatorIndex,
                BeaconProofs.BalanceProofLevel.BeaconBlock
            );
    }

    function balanceAtIndex(bytes32 validatorBalanceLeaf, uint64 validatorIndex)
        internal
        pure
        returns (uint256)
    {
        return
            BeaconProofs.balanceAtIndex(validatorBalanceLeaf, validatorIndex);
    }

    function verifyFirstPendingDepositSlot(
        bytes32 blockRoot,
        uint64 slot,
        bytes calldata firstPendingDepositSlotProof
    ) external view {
        BeaconProofs.verifyFirstPendingDepositSlot(
            blockRoot,
            slot,
            firstPendingDepositSlotProof
        );
    }

    function verifyBlockNumber(
        bytes32 beaconBlockRoot,
        uint256 blockNumber,
        bytes calldata blockNumberProof
    ) external view {
        BeaconProofs.verifyBlockNumber(
            beaconBlockRoot,
            blockNumber,
            blockNumberProof
        );
    }

    function verifySlot(
        bytes32 beaconBlockRoot,
        uint256 slot,
        bytes calldata slotProof
    ) external view {
        BeaconProofs.verifySlot(beaconBlockRoot, slot, slotProof);
    }
}
