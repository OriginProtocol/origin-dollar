// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITimelockController {
    function isOperation(bytes32 id) external view returns (bool);

    function isOperationPending(bytes32 id) external view returns (bool);

    function isOperationReady(bytes32 id) external view returns (bool);

    function isOperationDone(bytes32 id) external view returns (bool);

    function getMinDelay() external view returns (uint256 duration);

    function hashOperationBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas,
        bytes32 predecessor,
        bytes32 salt
    ) external pure returns (bytes32 hash);

    function scheduleBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas,
        bytes32 predecessor,
        bytes32 salt,
        uint256 delay
    ) external;

    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas,
        bytes32 predecessor,
        bytes32 salt
    ) external payable;

    function cancel(bytes32 id) external;
}
