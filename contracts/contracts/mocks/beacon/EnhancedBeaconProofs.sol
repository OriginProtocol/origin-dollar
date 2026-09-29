// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofsLib } from "../../beacon/BeaconProofsLib.sol";
import { BeaconProofsGloasLib } from "../../beacon/BeaconProofsGloasLib.sol";
import { BeaconProofs } from "../../beacon/BeaconProofs.sol";

contract EnhancedBeaconProofs is BeaconProofs {
    function concatGenIndices(
        uint256 index1,
        uint256 height2,
        uint256 index2
    ) external pure returns (uint256 genIndex) {
        return BeaconProofsLib.concatGenIndices(index1, height2, index2);
    }

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

    function gloasProgressiveChunkGindex(uint256 chunkIndex)
        external
        pure
        returns (uint256)
    {
        return BeaconProofsGloasLib.progressiveChunkGindex(chunkIndex);
    }

    function gloasProgressiveListElementGindex(uint256 elementIndex)
        external
        pure
        returns (uint256)
    {
        return BeaconProofsGloasLib.progressiveListElementGindex(elementIndex);
    }

    function gloasValidatorGindex(uint40 validatorIndex)
        external
        pure
        returns (uint256)
    {
        return BeaconProofsGloasLib.validatorGindex(validatorIndex);
    }

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

    function gloasBalancesContainerGindex() external pure returns (uint256) {
        return BeaconProofsGloasLib.balancesContainerGindex();
    }

    function gloasPendingDepositsContainerGindex()
        external
        pure
        returns (uint256)
    {
        return BeaconProofsGloasLib.pendingDepositsContainerGindex();
    }

    function gloasPendingDepositGindex(uint32 pendingDepositIndex)
        external
        pure
        returns (uint256)
    {
        return BeaconProofsGloasLib.pendingDepositGindex(pendingDepositIndex);
    }
}
