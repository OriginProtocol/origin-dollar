// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface INodeDriver {
    /// Seal epoch. Called BEFORE epoch sealing made by the client itself.
    function sealEpoch(
        uint256[] calldata offlineTimes,
        uint256[] calldata offlineBlocks,
        uint256[] calldata uptimes,
        uint256[] calldata originatedTxsFee
    ) external;
}
