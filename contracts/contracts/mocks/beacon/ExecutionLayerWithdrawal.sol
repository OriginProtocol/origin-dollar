// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { GeneralPurposeToConsensusLayerRequest } from "./GeneralPurposeToConsensusLayerRequest.sol";

contract ExecutionLayerWithdrawal is GeneralPurposeToConsensusLayerRequest {
    event WithdrawalRequestIssued(bytes publicKey, uint64 amount);

    bytes public lastPublicKey;
    uint64 public lastAmount;

    function handleRequest(bytes calldata data) internal override {
        // parameters should consist of 48 bytes for public key and 8 bytes for uint64 amount
        require(data.length == 56, "Invalid Withdrawal data");
        lastPublicKey = data[:48];
        lastAmount = uint64(bytes8(data[48:]));
        emit WithdrawalRequestIssued(lastPublicKey, lastAmount);
    }
}
