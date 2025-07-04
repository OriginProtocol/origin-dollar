// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { GeneralPurposeToConsenusLayerRequest } from "./GeneralPurposeToConsenusLayerRequest.sol";

contract ExecutionLayerConsolidation is GeneralPurposeToConsenusLayerRequest {
    event ConsolidationRequestIssued(bytes sourceKey, bytes targetKey);
    bytes public lastSource;
    bytes public lastTarget;

    function fee() internal override returns (uint256) {
        return 1;
    }

    function handleRequest(bytes calldata data) internal override {
        // parameters should consist of twice the 48 bytes for 2 public keys
        require(data.length == 96, "Invalid data length for Execution Layer Consolidation");
        lastSource = data[:48];
        lastTarget = data[48:];

        emit ConsolidationRequestIssued(lastSource, lastTarget);
    }
}
