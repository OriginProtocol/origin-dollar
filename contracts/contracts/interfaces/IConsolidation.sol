// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface IConsolidationSource {
    function confirmConsolidation()
        external
        returns (uint256 consolidationCount);
}

interface IConsolidationStrategy {
    function requestConsolidation(
        bytes32 targetPubKeyHash,
        address _targetConsolidationStrategy
    ) external;
}

interface IConsolidationTarget {
    function consolidationCompleted(
        bytes32 pubKeyHash,
        uint256 validatorBalance
    ) external;

    function initiateConsolidation(
        bytes32 pubKeyHash
    ) external;
}
