// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Governable } from "../governance/Governable.sol";
import { IPoolBoostCentralRegistry } from "../interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

/**
 * @title Contract that holds all governance approved pool booster Factory
 *        implementation deployments
 * @author Origin Protocol Inc
 */
contract PoolBoostCentralRegistry is Governable, IPoolBoostCentralRegistry {
    event FactoryApproved(address factoryAddress);
    event FactoryRemoved(address factoryAddress);

    // @notice List of approved factories
    address[] public factories;

    modifier onlyApprovedFactories() {
        require(isApprovedFactory(msg.sender), "Not an approved factory");
        _;
    }

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
        require(
            !isApprovedFactory(_factoryAddress),
            "Factory already approved"
        );

        factories.push(_factoryAddress);
        emit FactoryApproved(_factoryAddress);
    }

    /**
     * @notice Removes the factory from approved factory addresses
     * @param _factoryAddress address of the factory
     */
    function removeFactory(address _factoryAddress) external onlyGovernor {
        require(_factoryAddress != address(0), "Invalid address");

        uint256 length = factories.length;
        bool factoryRemoved = false;
        for (uint256 i = 0; i < length; i++) {
            if (factories[i] != _factoryAddress) {
                continue;
            }

            factories[i] = factories[length - 1];
            factories.pop();
            factoryRemoved = true;
            break;
        }
        require(factoryRemoved, "Not an approved factory");

        emit FactoryRemoved(_factoryAddress);
    }

    /**
     * @notice Emits a pool booster created event
     * @dev    This has been created as a convenience method for the monitoring to have
     *         an index of all of the created pool boosters by only listening to the
     *         events of this contract.
     * @param _poolBoosterAddress address of the pool booster created
     * @param _ammPoolAddress address of the AMM pool forwarding yield to the pool booster
     * @param _boosterType PoolBoosterType the type of the pool booster
     */
    function emitPoolBoosterCreated(
        address _poolBoosterAddress,
        address _ammPoolAddress,
        PoolBoosterType _boosterType
    ) external onlyApprovedFactories {
        emit PoolBoosterCreated(
            _poolBoosterAddress,
            _ammPoolAddress,
            _boosterType,
            msg.sender // address of the factory
        );
    }

    /**
     * @notice Emits a pool booster removed event
     * @dev    This has been created as a convenience method for the monitoring to have
     *         an index of all of the removed pool boosters by only listening to the
     *         events of this contract.
     * @param _poolBoosterAddress address of the pool booster to be removed
     */
    function emitPoolBoosterRemoved(address _poolBoosterAddress)
        external
        onlyApprovedFactories
    {
        emit PoolBoosterRemoved(_poolBoosterAddress);
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
    function getAllFactories() external view returns (address[] memory) {
        return factories;
    }
}
