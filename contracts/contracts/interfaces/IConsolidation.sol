// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface IConsolidationSource {
    function confirmConsolidation()
        external
        returns (uint256 consolidationCount);
}

interface IConsolidationStrategy {
    function requestConsolidation(
        bytes32 targetPubKeyHash
    ) external;
}

interface IConsolidationTarget {
    function receiveConsolidatedValidator(
        bytes32 pubKeyHash,
        uint256 ethStaked
    )external ;
}
