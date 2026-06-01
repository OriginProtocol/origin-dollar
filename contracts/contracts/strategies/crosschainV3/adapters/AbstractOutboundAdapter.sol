// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Governable } from "../../../governance/Governable.sol";
import { IOutboundAdapter } from "../../../interfaces/crosschainV3/IOutboundAdapter.sol";

/**
 * @title AbstractOutboundAdapter
 * @author Origin Protocol Inc
 *
 * @notice Shared base for OUSD V3 outbound bridge adapters. Provides:
 *           - governor-managed authorisation of senders (strategy → adapter)
 *           - destination-chain mapping
 *           - peer adapter address mapping (the corresponding receiver adapter on the
 *             destination chain)
 *           - native-fee withdrawal sweep
 *
 *         Concrete adapters (CCTP, CCIP, Superbridge…) implement the bridge-specific
 *         `_sendTokensAndMessage` / `_sendMessage` / `_estimateFee` hooks.
 */
abstract contract AbstractOutboundAdapter is IOutboundAdapter, Governable {
    using SafeERC20 for IERC20;

    /// @notice For an atomic adapter shared across multiple pairs, only authorised strategies
    ///         may invoke send functions.
    mapping(address => bool) public authorisedSenders;

    /// @notice Destination chain selector configured for each authorised sender. Concrete
    ///         adapters map this through to the bridge's destination ID format.
    mapping(address => uint64) public destinationFor;

    /// @notice Peer receiver adapter on the destination chain for each authorised sender.
    mapping(address => address) public peerReceiverFor;

    event SenderAuthorised(
        address indexed sender,
        uint64 destination,
        address peerReceiver
    );
    event SenderRevoked(address indexed sender);

    constructor() {
        // Bootstrap the deployer as initial governor; transfer to a Timelock /
        // multisig as part of the deploy flow.
        _setGovernor(msg.sender);
    }

    modifier onlyAuthorisedSender() {
        require(
            authorisedSenders[msg.sender],
            "Adapter: sender not authorised"
        );
        _;
    }

    /**
     * @notice Authorise a strategy to send on this adapter and set its destination + peer.
     *         `_peerReceiver == address(0)` is permitted during deploy bootstrap — outbound
     *         calls will fail at the bridge transport until the real peer is wired in via
     *         {setPeerReceiver}.
     */
    function authoriseSender(
        address _sender,
        uint64 _destination,
        address _peerReceiver
    ) external onlyGovernor {
        require(_sender != address(0), "Adapter: zero sender");
        authorisedSenders[_sender] = true;
        destinationFor[_sender] = _destination;
        peerReceiverFor[_sender] = _peerReceiver;
        emit SenderAuthorised(_sender, _destination, _peerReceiver);
    }

    /**
     * @notice Update the peer receiver for an already-authorised sender (post-deploy wiring).
     */
    function setPeerReceiver(address _sender, address _peerReceiver)
        external
        onlyGovernor
    {
        require(authorisedSenders[_sender], "Adapter: sender not authorised");
        require(_peerReceiver != address(0), "Adapter: zero peer");
        peerReceiverFor[_sender] = _peerReceiver;
        emit SenderAuthorised(_sender, destinationFor[_sender], _peerReceiver);
    }

    function revokeSender(address _sender) external onlyGovernor {
        authorisedSenders[_sender] = false;
        emit SenderRevoked(_sender);
    }

    /**
     * @notice Pay a native bridge fee from one of two sources:
     *           - `msg.value == 0` → pre-funded path. The adapter's own `address(this).balance`
     *             covers the fee. Used for protocol-driven yield-channel ops where the strategy
     *             entrypoint is non-payable; an operator (Defender autotask) tops up the
     *             adapter via `receive()` so calls never need to send native per-op.
     *           - `msg.value > 0` → user-paid path. The caller supplied the fee; any excess is
     *             refunded to `msg.sender` (the strategy). Used for user-driven bridge-channel
     *             ops.
     *
     *         Reverts if the chosen source doesn't cover `fee`.
     */
    function _consumeFee(uint256 fee) internal {
        if (msg.value == 0) {
            require(address(this).balance >= fee, "Adapter: unfunded");
            return;
        }
        require(msg.value >= fee, "Adapter: insufficient native fee");
        if (msg.value > fee) {
            uint256 refund = msg.value - fee;
            // slither-disable-next-line low-level-calls
            (bool ok, ) = msg.sender.call{ value: refund }("");
            require(ok, "Adapter: refund failed");
        }
    }

    /**
     * @notice Sweep stuck native to the governor. Intended only for recovery after a botched
     *         fee estimation; happy-path operations consume the full msg.value.
     */
    function sweepNative(address payable _to) external onlyGovernor {
        require(_to != address(0), "Adapter: zero to");
        // slither-disable-next-line low-level-calls
        (bool ok, ) = _to.call{ value: address(this).balance }("");
        require(ok, "Adapter: sweep failed");
    }

    /**
     * @notice Sweep stuck ERC20 to the governor. Recovery only.
     */
    function sweepToken(IERC20 _token, address _to) external onlyGovernor {
        require(_to != address(0), "Adapter: zero to");
        _token.safeTransfer(_to, _token.balanceOf(address(this)));
    }

    // --- IOutboundAdapter wiring -------------------------------------------

    function sendTokensAndMessage(
        address token,
        uint256 amount,
        bytes calldata message
    ) external payable virtual override onlyAuthorisedSender {
        _sendTokensAndMessage(
            token,
            amount,
            message,
            destinationFor[msg.sender],
            peerReceiverFor[msg.sender]
        );
    }

    function sendMessage(bytes calldata message)
        external
        payable
        virtual
        override
        onlyAuthorisedSender
    {
        _sendMessage(
            message,
            destinationFor[msg.sender],
            peerReceiverFor[msg.sender]
        );
    }

    function _sendTokensAndMessage(
        address token,
        uint256 amount,
        bytes calldata message,
        uint64 destination,
        address peerReceiver
    ) internal virtual;

    function _sendMessage(
        bytes calldata message,
        uint64 destination,
        address peerReceiver
    ) internal virtual;

    receive() external payable {}
}
