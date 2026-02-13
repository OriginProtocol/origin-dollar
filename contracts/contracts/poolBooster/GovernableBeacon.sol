// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IBeacon } from "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { Governable } from "../governance/Governable.sol";

/// @title GovernableBeacon
/// @author Origin Protocol
/// @notice Beacon contract using Origin's Governable for access control.
///         All BeaconProxy instances pointing to this beacon will use the
///         implementation returned by `implementation()`.
contract GovernableBeacon is IBeacon, Governable {
    address private _implementation;

    event Upgraded(address indexed implementation);

    constructor(address _impl, address _governor) {
        require(Address.isContract(_impl), "Impl is not a contract");
        require(_governor != address(0), "Invalid governor address");
        _implementation = _impl;
        _setGovernor(_governor);
        emit Upgraded(_impl);
    }

    /// @notice Returns the current implementation address
    function implementation() external view override returns (address) {
        return _implementation;
    }

    /// @notice Upgrades the beacon to a new implementation
    /// @param newImplementation Address of the new implementation contract
    function upgradeTo(address newImplementation) external onlyGovernor {
        require(
            Address.isContract(newImplementation),
            "Impl is not a contract"
        );
        _implementation = newImplementation;
        emit Upgraded(newImplementation);
    }
}
