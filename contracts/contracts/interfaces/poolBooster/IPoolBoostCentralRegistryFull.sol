// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

interface IPoolBoostCentralRegistryFull is IPoolBoostCentralRegistry {
    event FactoryApproved(address factoryAddress);
    event FactoryRemoved(address factoryAddress);

    function governor() external view returns (address);

    function isGovernor() external view returns (bool);

    function transferGovernance(address _newGovernor) external;

    function claimGovernance() external;

    function approveFactory(address _factoryAddress) external;

    function removeFactory(address _factoryAddress) external;

    function isApprovedFactory(address _factoryAddress) external view returns (bool);

    function getAllFactories() external view returns (address[] memory);
}
