// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Governable } from "../governance/Governable.sol";

/**
 * @title Contract that holds all governance approved pool booster Factory
 *        implementation deployments
 * @author Origin Protocol Inc
 */
contract PoolBoostCentralRegistry is Governable {
    event FactoryApproved(address factoryAddress);
    event FactoryRemoved(address factoryAddress);

    // @notice List of approved factories
    address[] public factories;

    constructor() {
        // set the governor of the implementation contract to zero address
        _setGovernor(address(0));
    }

    /**
     * @notice Adds a factory address to the approved factory addresses
     * @param _factoryAddress address of the factory
     */
    function approveFactory(address _factoryAddress) external onlyGovernor {
        require(_factoryAddress != address(0), "Invalid address");
        require(!isApprovedFactory(_factoryAddress), "Factory already approved");

        factories.push(_factoryAddress);
        emit FactoryApproved(_factoryAddress);
    }

    /**
     * @notice Removes the factory from approved factory addresses
     * @param _factoryAddress address of the factory
     */
    function removeFactory(address _factoryAddress) external onlyGovernor {
        require(_factoryAddress != address(0), "Invalid address");
        require(isApprovedFactory(_factoryAddress), "Not an approved factory");

        uint256 length = factories.length;
        for (uint256 i = 0; i < length; i++) {
            if (factories[i] != _factoryAddress) {
                continue;
            }

            factories[i] = factories[length - 1];
            factories.pop();
            emit FactoryRemoved(_factoryAddress);
            break;
        }
    }

    /**
     * @notice Returns true if the factory is approved
     * @param _factoryAddress address of the factory
     */
    function isApprovedFactory(address _factoryAddress)
        public
        view
        returns (bool)
    {
        uint256 length = factories.length;
        for (uint256 i = 0; i < length; i++) {
            if (factories[i] == _factoryAddress) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Returns all supported factories
     */
    function getAllFactories() public view returns (address[] memory) {
        return factories;
    }
}
