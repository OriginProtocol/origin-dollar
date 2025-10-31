// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconConsolidation } from "../beacon/BeaconConsolidation.sol";

contract MockBeaconConsolidation {
    function fee() external view returns (uint256) {
        return BeaconConsolidation.fee();
    }

    function request(bytes calldata source, bytes calldata target)
        external
        returns (uint256 fee_)
    {
        return BeaconConsolidation.request(source, target);
    }
}
