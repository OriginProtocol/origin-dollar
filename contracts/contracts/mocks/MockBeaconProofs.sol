// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofsLib } from "../beacon/BeaconProofsLib.sol";

contract MockBeaconProofs {
    function concatGenIndices(
        uint256 index1,
        uint256 height2,
        uint256 index2
    ) external pure returns (uint256 genIndex) {
        return BeaconProofsLib.concatGenIndices(index1, height2, index2);
    }

    function verifyValidatorPubkey(
        bytes32 beaconBlockRoot,
        bytes32 pubKeyHash,
        bytes calldata validatorPubKeyProof,
        uint64 validatorIndex
    ) external view {
        BeaconProofsLib.verifyValidatorPubkey(
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
        BeaconProofsLib.verifyBalancesContainer(
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
            BeaconProofsLib.verifyValidatorBalance(
                balancesContainerRoot,
                validatorBalanceLeaf,
                balanceProof,
                validatorIndex,
                BeaconProofsLib.BalanceProofLevel.Container
            );
    }

    function verifyValidatorBalanceInBeaconBlock(
        bytes32 beaconBlockRoot,
        bytes32 validatorBalanceLeaf,
        bytes calldata balanceProof,
        uint64 validatorIndex
    ) external view returns (uint256 validatorBalance) {
        return
            BeaconProofsLib.verifyValidatorBalance(
                beaconBlockRoot,
                validatorBalanceLeaf,
                balanceProof,
                validatorIndex,
                BeaconProofsLib.BalanceProofLevel.BeaconBlock
            );
    }

    function balanceAtIndex(bytes32 validatorBalanceLeaf, uint64 validatorIndex)
        internal
        pure
        returns (uint256)
    {
        return
            BeaconProofsLib.balanceAtIndex(
                validatorBalanceLeaf,
                validatorIndex
            );
    }

    function verifyFirstPendingDepositSlot(
        bytes32 blockRoot,
        uint64 slot,
        bytes calldata firstPendingDepositSlotProof
    ) external view {
        BeaconProofsLib.verifyFirstPendingDepositSlot(
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
        BeaconProofsLib.verifyBlockNumber(
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
        BeaconProofsLib.verifySlot(beaconBlockRoot, slot, slotProof);
    }
}
