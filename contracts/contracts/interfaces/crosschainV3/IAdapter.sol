// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IBridgeAdapter } from "./IBridgeAdapter.sol";

/// @dev Inherited by `AbstractAdapter`, so it declares only what that contract defines itself.
///      Governance (`governor` / `transferGovernance` / `claimGovernance`) comes from
///      `Governable`, whose functions are not virtual and so can't satisfy an interface.
interface IAdapter is IBridgeAdapter {
    /// @notice Per-lane routing config. One row per authorised sender.
    struct ChainConfig {
        bool paused;
        uint64 chainSelector; // destination chain identifier (protocol-specific encoding)
        uint32 destGasLimit; // gas hint forwarded to the receive callback on the peer
    }

    // Events
    event Authorised(address indexed sender, ChainConfig cfg);
    event Revoked(address indexed sender);
    event LaneConfigUpdated(address indexed sender, ChainConfig cfg);
    event LanePaused(address indexed sender);
    event LaneUnpaused(address indexed sender);
    event StrategistAdded(address indexed who);
    event StrategistRemoved(address indexed who);
    event MaxTransferAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event MessageSent(
        address indexed sender,
        address token,
        uint256 amount,
        uint256 feeCharged
    );
    event MessageDelivered(
        address indexed target,
        address token,
        uint256 amountReceived,
        uint256 feePaid
    );

    // Governance
    function authorise(address sender, ChainConfig calldata cfg) external;

    function revoke(address sender) external;

    function setLaneConfig(address sender, ChainConfig calldata cfg) external;

    function pauseLane(address sender) external;

    function unpauseLane(address sender) external;

    function addStrategist(address who) external;

    function removeStrategist(address who) external;

    function setMaxTransferAmount(uint256 amount) external;

    function transferToken(address asset, uint256 amount) external;

    // Views
    /// @dev Public mapping getter — a struct-valued mapping flattens to its members.
    function laneConfig(address sender)
        external
        view
        returns (
            bool paused,
            uint64 chainSelector,
            uint32 destGasLimit
        );

    function authorised(address sender) external view returns (bool);

    function strategists(address who) external view returns (bool);
}
