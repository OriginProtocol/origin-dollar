// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Cluster } from "./../interfaces/ISSVNetwork.sol";

contract MockSSVNetwork {
    uint256 public registeredValidators;
    uint256 public exitedValidators;
    uint256 public removedValidators;

    /* solhint-disable no-unused-vars */
    function registerValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        bytes calldata sharesData,
        uint256 amount,
        Cluster memory cluster
    ) external {
        registeredValidators += 1;
    }

    function bulkRegisterValidator(
        bytes[] calldata publicKeys,
        uint64[] calldata operatorIds,
        bytes[] calldata sharesData,
        uint256 amount,
        Cluster memory cluster
    ) external {
        registeredValidators += publicKeys.length;
    }

    function exitValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds
    ) external {
        exitedValidators += 1;
    }

    function removeValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        Cluster memory cluster
    ) external {
        removedValidators += 1;
    }

    function deposit(
        address clusterOwner,
        uint64[] calldata operatorIds,
        uint256 amount,
        Cluster memory cluster
    ) external {}
    /* solhint-enable no-unused-vars */
}
