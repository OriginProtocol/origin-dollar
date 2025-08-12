// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProofsLib } from "../beacon/BeaconProofsLib.sol";
import { BeaconProofs } from "../beacon/BeaconProofs.sol";

contract MockBeaconProofs is BeaconProofs {
    function concatGenIndices(
        uint256 index1,
        uint256 height2,
        uint256 index2
    ) external pure returns (uint256 genIndex) {
        return BeaconProofsLib.concatGenIndices(index1, height2, index2);
    }
}
