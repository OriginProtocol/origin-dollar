// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Governable } from "../../../governance/Governable.sol";
import { IBridgeReceiver } from "../../../interfaces/crosschainV3/IBridgeReceiver.sol";
import { IOutboundAdapter } from "../../../interfaces/crosschainV3/IOutboundAdapter.sol";
import { CrossChainV3Helper } from "../CrossChainV3Helper.sol";

/**
 * @title AbstractAdapter
 * @author Origin Protocol Inc
 *
 * @notice Shared base for OUSD V3 bridge adapters. A single adapter serves both directions
 *         for one bridge protocol (outbound `IOutboundAdapter` + the protocol-specific
 *         inbound entry point), multi-tenant so one deployment can serve many strategy
 *         pairs.
 *
 *         The base provides:
 *           - a flat `authorised[address]` whitelist that gates BOTH directions
 *             (msg.sender on outbound, envelope sender on inbound — CreateX cross-chain
 *             address parity means they're the same address for a given strategy pair).
 *           - per-sender `destinationFor` and `peerReceiverFor` mappings (outbound routing).
 *           - a `_deliverAtomic` helper for forwarding inbound deliveries.
 *           - a `transferToken` sweep for stuck tokens / native (address(0) = native).
 *
 *         Bridge-specific behaviour (CCIP / CCTP / canonical-bridge transports, fee models,
 *         envelope decoding) lives entirely in the concrete adapters.
 */
abstract contract AbstractAdapter is IOutboundAdapter, Governable {
    using SafeERC20 for IERC20;

    /// @notice Whitelist of strategy addresses authorised to use this adapter — both as
    ///         outbound `msg.sender` and as the envelope sender on inbound. Under CreateX
    ///         parity, a strategy has the same address on every chain it lives on.
    mapping(address => bool) public authorised;

    /// @notice Destination chain selector per authorised sender. Concrete adapters map this
    ///         through to the bridge's destination ID format (e.g., CCTP uint32 domain).
    mapping(address => uint64) public destinationFor;

    /// @notice Peer receiver adapter address on the destination chain, per authorised sender.
    mapping(address => address) public peerReceiverFor;

    event SenderAuthorised(
        address indexed sender,
        uint64 destination,
        address peerReceiver
    );
    event PeerReceiverUpdated(address indexed sender, address peerReceiver);
    event SenderRevoked(address indexed sender);
    event MessageDelivered(
        address indexed target,
        uint64 nonce,
        uint8 messageType
    );

    constructor() {
        // Bootstrap the deployer as initial governor; transfer to a Timelock /
        // multisig as part of the deploy flow.
        _setGovernor(msg.sender);
    }

    modifier onlyAuthorisedSender() {
        require(authorised[msg.sender], "Adapter: sender not authorised");
        _;
    }

    /**
     * @notice Authorise `_sender` to use this adapter and wire its outbound routing.
     *         `_peerReceiver == address(0)` is permitted during deploy bootstrap; outbound
     *         calls will fail at the bridge transport until {setPeerReceiver} is run.
     */
    function authoriseSender(
        address _sender,
        uint64 _destination,
        address _peerReceiver
    ) external onlyGovernor {
        require(_sender != address(0), "Adapter: zero sender");
        authorised[_sender] = true;
        destinationFor[_sender] = _destination;
        peerReceiverFor[_sender] = _peerReceiver;
        emit SenderAuthorised(_sender, _destination, _peerReceiver);
    }

    /**
     * @notice Add `_sender` to the whitelist without setting outbound routing. Convenience
     *         for inbound-only configuration: a strategy on the peer chain is allowed to
     *         deliver via this adapter, but this adapter never sends outbound for it.
     *         (Under CreateX cross-chain parity, the peer's address on this chain is also
     *         the destination strategy for inbound forwarding.)
     */
    function authorise(address _sender) external onlyGovernor {
        require(_sender != address(0), "Adapter: zero sender");
        authorised[_sender] = true;
        emit SenderAuthorised(_sender, 0, address(0));
    }

    /**
     * @notice Update the peer receiver for an already-authorised sender (post-deploy wiring).
     */
    function setPeerReceiver(address _sender, address _peerReceiver)
        external
        onlyGovernor
    {
        require(authorised[_sender], "Adapter: sender not authorised");
        require(_peerReceiver != address(0), "Adapter: zero peer");
        peerReceiverFor[_sender] = _peerReceiver;
        emit PeerReceiverUpdated(_sender, _peerReceiver);
    }

    function revokeSender(address _sender) external onlyGovernor {
        authorised[_sender] = false;
        emit SenderRevoked(_sender);
    }

    /**
     * @notice Transfer token (or native) to governor. Recovery only — used to rescue
     *         stuck tokens (mistaken sends, leftover approvals) or to drain a stale
     *         pre-funded fee reserve.
     *
     *         `_asset == address(0)` is treated as the native-token sentinel.
     */
    function transferToken(address _asset, uint256 _amount)
        external
        onlyGovernor
    {
        if (_asset == address(0)) {
            // slither-disable-next-line low-level-calls
            (bool ok, ) = governor().call{ value: _amount }("");
            require(ok, "Adapter: native transfer failed");
        } else {
            IERC20(_asset).safeTransfer(governor(), _amount);
        }
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

    // --- Inbound helpers ----------------------------------------------------

    /**
     * @dev Unwrap a V3 envelope, verify the version, and check the envelope sender is on the
     *      whitelist. Returns the decoded fields. Reverts on any validation failure.
     *
     *      Concrete inbound entry points use this to avoid duplicating the same decode +
     *      version-check + whitelist-check ritual.
     */
    function _unwrapAndValidate(bytes memory messageData)
        internal
        view
        returns (
            uint32 msgType,
            uint64 nonce,
            address envelopeSender,
            bytes memory payload
        )
    {
        uint32 version;
        (version, msgType, nonce, envelopeSender, payload) = CrossChainV3Helper
            .unwrap(messageData);
        require(
            version == CrossChainV3Helper.ORIGIN_V3_MESSAGE_VERSION,
            "Adapter: bad version"
        );
        require(authorised[envelopeSender], "Adapter: not authorised");
    }

    /**
     * @dev Forward a fully-formed inbound delivery to the target strategy. Atomic concrete
     *      adapters call this directly after their bridge transport has placed tokens on
     *      this adapter. Split-delivery adapters call it from their finaliser once both
     *      legs have landed. `target` is the destination strategy on this chain (equal to
     *      the decoded envelope sender thanks to CreateX cross-chain parity).
     */
    function _deliverAtomic(
        address target,
        uint64 nonce,
        uint256 amount,
        uint8 messageType,
        bytes memory payload,
        address token
    ) internal {
        if (amount > 0 && token != address(0)) {
            IERC20(token).safeTransfer(target, amount);
        }
        IBridgeReceiver(target).receiveFromBridge(
            nonce,
            amount,
            messageType,
            payload
        );
        emit MessageDelivered(target, nonce, messageType);
    }

    receive() external payable {}
}
