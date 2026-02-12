// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {AbstractPoolBoosterFactory, IPoolBoostCentralRegistry} from "./AbstractPoolBoosterFactory.sol";

/// @title PoolBoosterFactoryMerkl
/// @author Origin Protocol
/// @notice Factory for creating Merkl pool boosters using minimal proxies (EIP-1167).
contract PoolBoosterFactoryMerkl is AbstractPoolBoosterFactory {

    ////////////////////////////////////////////////////
    /// --- CONSTANTS
    ////////////////////////////////////////////////////

    /// @notice Contract version
    string public constant VERSION = "1.0.0";

    ////////////////////////////////////////////////////
    /// --- STORAGE
    ////////////////////////////////////////////////////

    /// @notice Address of the PoolBoosterMerkl implementation contract
    address public implementation;

    ////////////////////////////////////////////////////
    /// --- EVENTS
    ////////////////////////////////////////////////////

    event ImplementationUpdated(address newImplementation);

    ////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    ////////////////////////////////////////////////////

    /// @notice Initialize the factory
    /// @param _oToken Address of the OToken token
    /// @param _governor Address of the governor
    /// @param _centralRegistry Address of the central registry
    constructor(
        address _oToken,
        address _governor,
        address _centralRegistry
    ) AbstractPoolBoosterFactory(_oToken, _governor, _centralRegistry) {}

    ////////////////////////////////////////////////////
    /// --- CORE LOGIC
    ////////////////////////////////////////////////////

    /// @notice Create a Pool Booster for Merkl using a minimal proxy clone
    /// @param _ammPoolAddress Address of the AMM pool where the yield originates from
    /// @param _initData Encoded call data for initializing the clone
    /// @param _salt Unique number that determines the clone address
    function createPoolBoosterMerkl(
        address _ammPoolAddress,
        bytes calldata _initData,
        uint256 _salt
    ) external onlyGovernor {
        require(_ammPoolAddress != address(0), "Invalid ammPoolAddress address");
        require(_salt > 0, "Invalid salt");
        require(implementation != address(0), "Implementation not set");

        address clone = Clones.cloneDeterministic(
            implementation,
            bytes32(_salt)
        );

        (bool success, ) = clone.call(_initData);
        require(success, "Initialization failed");

        _storePoolBoosterEntry(
            clone,
            _ammPoolAddress,
            IPoolBoostCentralRegistry.PoolBoosterType.MerklBooster
        );
    }

    ////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    ////////////////////////////////////////////////////

    /// @notice Compute the deterministic address of a Pool Booster clone
    /// @param _salt Unique number matching the one used in createPoolBoosterMerkl
    /// @return The predicted clone address
    function computePoolBoosterAddress(uint256 _salt) external view returns (address) {
        require(_salt > 0, "Invalid salt");
        return Clones.predictDeterministicAddress(implementation, bytes32(_salt));
    }

    ////////////////////////////////////////////////////
    /// --- SETTERS
    ////////////////////////////////////////////////////

    /// @notice Set the address of the implementation contract
    /// @param _implementation New PoolBoosterMerklV2 implementation address
    function setImplementation(address _implementation) external onlyGovernor {
        require(_implementation != address(0), "Invalid implementation address");
        implementation = _implementation;
        emit ImplementationUpdated(_implementation);
    }
}
