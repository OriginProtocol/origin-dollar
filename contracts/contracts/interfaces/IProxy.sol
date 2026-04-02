// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IProxy {
    event Upgraded(address indexed implementation);

    function initialize(address _logic, address _initGovernor, bytes calldata _data) external payable;

    function admin() external view returns (address);

    function implementation() external view returns (address);

    function upgradeTo(address _newImplementation) external;

    function upgradeToAndCall(address newImplementation, bytes calldata data) external payable;
}
