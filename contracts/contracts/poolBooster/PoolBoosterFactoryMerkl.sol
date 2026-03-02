// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { BeaconProxy } from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import { UpgradeableBeacon } from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import { AbstractPoolBoosterFactory, IPoolBoostCentralRegistry } from "./AbstractPoolBoosterFactory.sol";

/// @title PoolBoosterFactoryMerkl
/// @author Origin Protocol
/// @notice Factory for creating Merkl pool boosters using BeaconProxy.
contract PoolBoosterFactoryMerkl is AbstractPoolBoosterFactory {
    ////////////////////////////////////////////////////
    /// --- CONSTANTS
    ////////////////////////////////////////////////////

    /// @notice Contract version
    string public constant VERSION = "1.0.0";

    ////////////////////////////////////////////////////
    /// --- STORAGE
    ////////////////////////////////////////////////////

    /// @notice Address of the UpgradeableBeacon
    address public beacon;

    ////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    ////////////////////////////////////////////////////

    /// @param _oToken Address of the OToken
    /// @param _governor Address of the governor
    /// @param _centralRegistry Address of the central registry
    /// @param _beacon Address of the UpgradeableBeacon
    constructor(
        address _oToken,
        address _governor,
        address _centralRegistry,
        address _beacon
    ) AbstractPoolBoosterFactory(_oToken, _governor, _centralRegistry) {
        require(_beacon != address(0), "Invalid beacon address");
        beacon = _beacon;
    }

    ////////////////////////////////////////////////////
    /// --- CORE LOGIC
    ////////////////////////////////////////////////////

    /// @notice Create a Pool Booster for Merkl using a BeaconProxy
    /// @param _ammPoolAddress Address of the AMM pool
    /// @param _initData Encoded call data for initializing the proxy
    /// @param _salt Unique number that determines the proxy address
    function createPoolBoosterMerkl(
        address _ammPoolAddress,
        bytes calldata _initData,
        uint256 _salt
    ) external onlyGovernor {
        require(
            _ammPoolAddress != address(0),
            "Invalid ammPoolAddress address"
        );
        require(_salt > 0, "Invalid salt");
        require(
            poolBoosterFromPool[_ammPoolAddress].boosterAddress == address(0),
            "Pool booster already exists"
        );

        address proxy = address(
            new BeaconProxy{ salt: bytes32(_salt) }(beacon, _initData)
        );

        _storePoolBoosterEntry(
            proxy,
            _ammPoolAddress,
            IPoolBoostCentralRegistry.PoolBoosterType.MerklBooster
        );
    }

    /// @notice Calls bribe() on all pool boosters, skipping those in the exclusion list
    /// @param _exclusionList A list of pool booster addresses to skip
    function bribeAll(address[] memory _exclusionList)
        public
        override
        onlyGovernor
    {
        super.bribeAll(_exclusionList);
    }

    /// @notice Removes a pool booster from the internal list
    /// @param _poolBoosterAddress Address of the pool booster to remove
    function removePoolBooster(address _poolBoosterAddress)
        external
        override
        onlyGovernor
    {
        uint256 boostersLen = poolBoosters.length;
        bool found = false;
        for (uint256 i = 0; i < boostersLen; ++i) {
            if (poolBoosters[i].boosterAddress == _poolBoosterAddress) {
                delete poolBoosterFromPool[poolBoosters[i].ammPoolAddress];
                poolBoosters[i] = poolBoosters[boostersLen - 1];
                poolBoosters.pop();
                centralRegistry.emitPoolBoosterRemoved(_poolBoosterAddress);
                found = true;
                break;
            }
        }
        require(found, "Pool booster not found");
    }

    ////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    ////////////////////////////////////////////////////

    /// @notice Compute the deterministic address of a BeaconProxy
    /// @param _salt Unique number matching the one used in createPoolBoosterMerkl
    /// @param _initData Encoded call data matching the one used in createPoolBoosterMerkl
    /// @return The predicted proxy address
    function computePoolBoosterAddress(uint256 _salt, bytes calldata _initData)
        external
        view
        returns (address)
    {
        require(_salt > 0, "Invalid salt");

        bytes memory bytecode = abi.encodePacked(
            type(BeaconProxy).creationCode,
            abi.encode(beacon, _initData)
        );
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                bytes32(_salt),
                keccak256(bytecode)
            )
        );
        return address(uint160(uint256(hash)));
    }
}
