// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofsLib } from "../../beacon/BeaconProofsLib.sol";
import { BeaconProofsGloasLib } from "../../beacon/BeaconProofsGloasLib.sol";
import { BeaconProofs } from "../../beacon/BeaconProofs.sol";

contract EnhancedBeaconProofs is BeaconProofs {
    /// @notice Appends a subtree path to a generalized index.
    /// @param index1 Generalized index of the subtree root.
    /// @param height2 Number of path bits in the subtree.
    /// @param index2 Zero-based index within the subtree.
    /// @return genIndex Concatenated generalized index.
    function concatGenIndices(
        uint256 index1,
        uint256 height2,
        uint256 index2
    ) external pure returns (uint256 genIndex) {
        return BeaconProofsLib.concatGenIndices(index1, height2, index2);
    }

    /// @notice Extracts a validator balance from a packed SSZ chunk.
    /// @param validatorBalanceLeaf Chunk containing four little-endian uint64 balances.
    /// @param validatorIndex Validator index whose remainder modulo four selects the balance.
    /// @return The selected balance in Gwei.
    function balanceAtIndex(bytes32 validatorBalanceLeaf, uint40 validatorIndex)
        external
        pure
        returns (uint256)
    {
        return
            BeaconProofsLib.balanceAtIndex(
                validatorBalanceLeaf,
                validatorIndex
            );
    }

    /// @notice Returns a chunk's generalized index within a progressive chunks tree.
    /// @param chunkIndex Zero-based SSZ chunk index.
    /// @return Generalized index relative to the chunks tree root.
    function gloasProgressiveChunkGindex(uint256 chunkIndex)
        external
        pure
        returns (uint256)
    {
        return BeaconProofsGloasLib.progressiveChunkGindex(chunkIndex);
    }

    /// @notice Returns an element chunk's generalized index within a progressive list.
    /// @param elementIndex Zero-based chunk index; divide a validator balance index by four first.
    /// @return Generalized index relative to the progressive list root.
    function gloasProgressiveListElementGindex(uint256 elementIndex)
        external
        pure
        returns (uint256)
    {
        return BeaconProofsGloasLib.progressiveListElementGindex(elementIndex);
    }

    /// @notice Returns a Gloas validator container's generalized index within a beacon block.
    /// @param validatorIndex Index in the beacon state's validator registry.
    /// @return Generalized index relative to the beacon block root.
    function gloasValidatorGindex(uint40 validatorIndex)
        external
        pure
        returns (uint256)
    {
        return BeaconProofsGloasLib.validatorGindex(validatorIndex);
    }

    /// @notice Returns a validator field's generalized index within a Gloas beacon block.
    /// @param validatorIndex Index in the beacon state's validator registry.
    /// @param fieldIndex Zero-based field index in the Validator container.
    /// @return Generalized index relative to the beacon block root.
    function gloasValidatorFieldGindex(
        uint40 validatorIndex,
        uint256 fieldIndex
    ) external pure returns (uint256) {
        return
            BeaconProofsGloasLib.validatorFieldGindex(
                validatorIndex,
                fieldIndex
            );
    }

    /// @notice Returns the Gloas balances list's generalized index within a beacon block.
    /// @return Generalized index relative to the beacon block root.
    function gloasBalancesContainerGindex() external pure returns (uint256) {
        return BeaconProofsGloasLib.balancesContainerGindex();
    }

    /// @notice Returns the Gloas pending-deposits list's generalized index within a beacon block.
    /// @return Generalized index relative to the beacon block root.
    function gloasPendingDepositsContainerGindex()
        external
        pure
        returns (uint256)
    {
        return BeaconProofsGloasLib.pendingDepositsContainerGindex();
    }

    /// @notice Returns a pending deposit's generalized index within a Gloas beacon block.
    /// @param pendingDepositIndex Index in the pending-deposits list.
    /// @return Generalized index relative to the beacon block root.
    function gloasPendingDepositGindex(uint32 pendingDepositIndex)
        external
        pure
        returns (uint256)
    {
        return BeaconProofsGloasLib.pendingDepositGindex(pendingDepositIndex);
    }
}
