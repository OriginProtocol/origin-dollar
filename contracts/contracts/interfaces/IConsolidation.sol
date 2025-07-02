// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface IConsolidationSource {
    function confirmConsolidation() external;
}

interface IConsolidationTarget {
    function requestConsolidation(
        bytes32 lastSourcePubKeyHash,
        bytes32 targetPubKeyHash
    ) external;
}
