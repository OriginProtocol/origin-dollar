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
        uint256 validatorIndex,
        bytes calldata validatorPubKeyProof
    ) external view {
        BeaconProofs.verifyValidatorPubkey(
            beaconBlockRoot,
            pubKeyHash,
            validatorIndex,
            validatorPubKeyProof
        );
    }

    // function verifyBalancesContainer(
    //     bytes32 beaconBlockRoot,
    //     bytes32 validatorContainerRoot,
    //     bytes calldata balancesContainerProof
    // ) external view {
    //     BeaconProofs.verifyBalancesContainer(
    //         beaconBlockRoot,
    //         validatorContainerRoot,
    //         balancesContainerProof
    //     );
    // }

    // function verifyValidatorBalance(
    //     bytes32 balancesContainerRoot,
    //     uint256 validatorIndex,
    //     bytes32 validatorBalanceRoot,
    //     bytes calldata balanceProof
    // ) external view returns (uint256 validatorBalance) {
    //     return
    //         BeaconProofs.verifyValidatorBalance(
    //             balancesContainerRoot,
    //             validatorIndex,
    //             validatorBalanceRoot,
    //             balanceProof
    //         );
    // }

    // function balanceAtIndex(
    //     bytes32 validatorBalanceRoot,
    //     uint40 validatorIndex
    // ) internal pure returns (uint256) {
    //     return
    //         BeaconProofs.balanceAtIndex(validatorBalanceRoot, validatorIndex);
    // }

    // function verifyFirstPendingDepositSlot(
    //     bytes32 blockRoot,
    //     uint64 slot,
    //     bytes calldata firstPendingDepositSlotProof
    // ) external view {
    //     BeaconProofs.verifyFirstPendingDepositSlot(
    //         blockRoot,
    //         slot,
    //         firstPendingDepositSlotProof
    //     );
    // }

    // function verifyBlockNumber(
    //     bytes32 beaconBlockRoot,
    //     uint256 blockNumber,
    //     bytes calldata blockNumberProof
    // ) external view {
    //     BeaconProofs.verifyBlockNumber(
    //         beaconBlockRoot,
    //         blockNumber,
    //         blockNumberProof
    //     );
    // }

    // function verifySlot(
    //     bytes32 beaconBlockRoot,
    //     uint256 slot,
    //     bytes calldata slotProof
    // ) external view {
    //     BeaconProofs.verifySlot(beaconBlockRoot, slot, slotProof);
    // }
}
