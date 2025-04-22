// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Cluster } from "./../interfaces/ISSVNetwork.sol";

contract MockSSVNetwork {
    function registerValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        bytes calldata sharesData,
        uint256 amount,
        Cluster memory cluster
    ) external {}

    function bulkRegisterValidator(
        bytes[] calldata publicKeys,
        uint64[] calldata operatorIds,
        bytes[] calldata sharesData,
        uint256 amount,
        Cluster memory cluster
    ) external {}

    function exitValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds
    ) external {}

    function removeValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        Cluster memory cluster
    ) external {}

    function deposit(
        address clusterOwner,
        uint64[] calldata operatorIds,
        uint256 amount,
        Cluster memory cluster
    ) external {}

    function setFeeRecipientAddress(address recipient) external {}
}
