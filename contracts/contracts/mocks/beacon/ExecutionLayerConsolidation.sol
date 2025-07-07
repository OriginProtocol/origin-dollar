// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { GeneralPurposeToConsensusLayerRequest } from "./GeneralPurposeToConsensusLayerRequest.sol";

contract ExecutionLayerConsolidation is GeneralPurposeToConsensusLayerRequest {
    event ConsolidationRequestIssued(bytes sourceKey, bytes targetKey);
    bytes public lastSource;
    bytes public lastTarget;

    function handleRequest(bytes calldata data) internal override {
        // parameters should consist of twice the 48 bytes for 2 public keys
        require(data.length == 96, "Invalid Consolidation data");
        lastSource = data[:48];
        lastTarget = data[48:];

        emit ConsolidationRequestIssued(lastSource, lastTarget);
    }
}
