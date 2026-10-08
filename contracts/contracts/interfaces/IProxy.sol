// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IProxy {
    event Upgraded(address indexed implementation);
    event PendingGovernorshipTransfer(
        address indexed previousGovernor,
        address indexed newGovernor
    );
    event GovernorshipTransferred(
        address indexed previousGovernor,
        address indexed newGovernor
    );

    function initialize(
        address _logic,
        address _initGovernor,
        bytes calldata _data
    ) external payable;

    function admin() external view returns (address);

    function governor() external view returns (address);

    function isGovernor() external view returns (bool);

    function implementation() external view returns (address);

    function transferGovernance(address _newGovernor) external;

    function claimGovernance() external;

    function upgradeTo(address _newImplementation) external;

    function upgradeToAndCall(address newImplementation, bytes calldata data)
        external
        payable;
}
