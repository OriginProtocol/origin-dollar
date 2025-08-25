// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface IConsolidationSource {
    function confirmConsolidation()
        external
        returns (uint256 consolidationCount);
}

interface IConsolidationTarget {
    function requestConsolidation(
        bytes32 lastSourcePubKeyHash,
        bytes32 targetPubKeyHash
    ) external;
}
