// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";

interface IPoolBoosterFactory {
    function bribeAll(address[] memory _exclusionList) external;
}

/// @title MerklPoolBoosterBribesModule
/// @author Origin Protocol
/// @notice Gnosis Safe module that automates Merkl bribe campaigns by calling
///         `bribeAll` on the PoolBoosterFactoryMerkl contract through the Safe.
contract MerklPoolBoosterBribesModule is AbstractSafeModule {
    ////////////////////////////////////////////////////
    /// --- Storage
    ////////////////////////////////////////////////////

    /// @notice Address of the PoolBoosterFactoryMerkl contract
    address public factory;

    ////////////////////////////////////////////////////
    /// --- Constructor
    ////////////////////////////////////////////////////

    /// @param _safeContract Address of the Gnosis Safe this module is attached to
    /// @param _operator Address authorized to call operator-restricted functions
    /// @param _factory Address of the PoolBoosterFactoryMerkl contract
    constructor(
        address _safeContract,
        address _operator,
        address _factory
    ) AbstractSafeModule(_safeContract) {
        _grantRole(OPERATOR_ROLE, _operator);
        _setFactory(_factory);
    }

    ////////////////////////////////////////////////////
    /// --- Events
    ////////////////////////////////////////////////////

    event FactoryUpdated(address newFactory);

    ////////////////////////////////////////////////////
    /// --- External Mutative Functions
    ////////////////////////////////////////////////////

    /// @notice Update the PoolBoosterFactoryMerkl address
    /// @param _factory New factory address
    function setFactory(address _factory) external onlySafe {
        _setFactory(_factory);
    }

    ////////////////////////////////////////////////////
    /// --- Internal Functions
    ////////////////////////////////////////////////////

    /// @notice Internal logic to set the factory address
    /// @param _factory New factory address
    function _setFactory(address _factory) internal {
        require(_factory != address(0), "Zero address");
        factory = _factory;
        emit FactoryUpdated(_factory);
    }

    /// @notice Instructs the Safe to call `bribeAll` on the PoolBoosterFactoryMerkl contract
    /// @param _exclusionList List of pool booster addresses to exclude from bribing
    function bribeAll(address[] calldata _exclusionList) external onlyOperator {
        require(
            safeContract.execTransactionFromModule(
                factory,
                0,
                abi.encodeWithSelector(
                    IPoolBoosterFactory.bribeAll.selector,
                    _exclusionList
                ),
                0
            ),
            "bribeAll failed"
        );
    }
}
