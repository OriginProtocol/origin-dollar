// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Cluster } from "./../interfaces/ISSVNetwork.sol";

contract MockSSVNetwork {
    error ValidatorAlreadyExists();

    mapping(bytes32 => bool) public validatorExists;

    function registerValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        bytes calldata sharesData,
        Cluster memory cluster
    ) external payable {
        bytes32 pubKeyHash = keccak256(publicKey);
        if (validatorExists[pubKeyHash]) revert ValidatorAlreadyExists();
        validatorExists[pubKeyHash] = true;
    }

    function bulkRegisterValidator(
        bytes[] calldata publicKeys,
        uint64[] calldata operatorIds,
        bytes[] calldata sharesData,
        Cluster memory cluster
    ) external payable {}

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
        Cluster memory cluster
    ) external payable {}

    function setFeeRecipientAddress(address recipient) external {}
}
