// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ITimelockController {
    function grantRole(bytes32 role, address account) external;

    function revokeRole(bytes32 role, address account) external;

    function renounceRole(bytes32 role, address account) external;

    function hasRole(bytes32 role, address account)
        external
        view
        returns (bool);

    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt
    ) external payable;

    function scheduleBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) external;

    function hashOperationBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata payloads,
        bytes32 predecessor,
        bytes32 salt
    ) external view returns (bytes32);

    function isOperationDone(bytes32 opHash) external view returns (bool);

    function isOperationReady(bytes32 opHash) external view returns (bool);

    function isOperation(bytes32 opHash) external view returns (bool);

    function getMinDelay() external view returns (uint256);

    function updateDelay(uint256 newDelay) external;

    function CANCELLER_ROLE() external view returns (bytes32);
}
