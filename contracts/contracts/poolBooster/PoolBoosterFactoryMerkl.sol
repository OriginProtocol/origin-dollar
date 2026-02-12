// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {PoolBoosterMerklV2} from "./PoolBoosterMerkl.sol";
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

    /// @notice Address of the Merkl distributor
    address public merklDistributor;

    /// @notice Address of the PoolBoosterMerklV2 implementation contract
    address public implementation;

    /// @notice Address of the strategist
    address public strategist;

    ////////////////////////////////////////////////////
    /// --- EVENTS
    ////////////////////////////////////////////////////

    event MerklDistributorUpdated(address newDistributor);
    event ImplementationUpdated(address newImplementation);
    event StrategistUpdated(address newStrategist);

    ////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    ////////////////////////////////////////////////////

    /// @notice Initialize the factory
    /// @param _oToken Address of the OToken token
    /// @param _governor Address of the governor
    /// @param _centralRegistry Address of the central registry
    /// @param _merklDistributor Address of the Merkl distributor
    constructor(
        address _oToken,
        address _governor,
        address _centralRegistry,
        address _merklDistributor
    ) AbstractPoolBoosterFactory(_oToken, _governor, _centralRegistry) {
        _setMerklDistributor(_merklDistributor);
    }

    ////////////////////////////////////////////////////
    /// --- CORE LOGIC
    ////////////////////////////////////////////////////

    /// @notice Create a Pool Booster for Merkl using a minimal proxy clone
    /// @param _campaignType Type identifier for the Merkl campaign
    /// @param _ammPoolAddress Address of the AMM pool where the yield originates from
    /// @param _campaignDuration Duration of the campaign in seconds
    /// @param _campaignData Encoded campaign data for the Merkl distributor
    /// @param _salt Unique number that determines the clone address
    function createPoolBoosterMerkl(
        uint32 _campaignType,
        address _ammPoolAddress,
        uint32 _campaignDuration,
        bytes calldata _campaignData,
        uint256 _salt
    ) external onlyGovernor {
        require(_ammPoolAddress != address(0), "Invalid ammPoolAddress address");
        require(_salt > 0, "Invalid salt");
        require(_campaignDuration > 1 hours, "Invalid campaign duration");
        require(_campaignData.length > 0, "Invalid campaign data");
        require(implementation != address(0), "Implementation not set");

        address clone = Clones.cloneDeterministic(
            implementation,
            bytes32(_salt)
        );

        PoolBoosterMerklV2(clone).initialize(
            _campaignDuration,
            _campaignType,
            oToken,
            merklDistributor,
            governor(),
            strategist,
            _campaignData
        );

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

    /// @notice Set the address of the Merkl distributor
    /// @param _merklDistributor New Merkl distributor address
    function setMerklDistributor(address _merklDistributor) external onlyGovernor {
        _setMerklDistributor(_merklDistributor);
    }

    /// @notice Internal logic to set the Merkl distributor
    /// @param _merklDistributor New Merkl distributor address, must be non-zero
    function _setMerklDistributor(address _merklDistributor) internal {
        require(_merklDistributor != address(0), "Invalid merklDistributor address");
        merklDistributor = _merklDistributor;
        emit MerklDistributorUpdated(_merklDistributor);
    }

    /// @notice Set the address of the implementation contract
    /// @param _implementation New PoolBoosterMerklV2 implementation address
    function setImplementation(address _implementation) external onlyGovernor {
        require(_implementation != address(0), "Invalid implementation address");
        implementation = _implementation;
        emit ImplementationUpdated(_implementation);
    }

    /// @notice Set the address of the strategist
    /// @param _strategist New strategist address
    function setStrategist(address _strategist) external onlyGovernor {
        require(_strategist != address(0), "Invalid strategist address");
        strategist = _strategist;
        emit StrategistUpdated(_strategist);
    }
}
