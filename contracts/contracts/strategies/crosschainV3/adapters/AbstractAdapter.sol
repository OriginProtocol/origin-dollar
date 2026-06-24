// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Governable } from "../../../governance/Governable.sol";
import { IBridgeAdapter } from "../../../interfaces/crosschainV3/IBridgeAdapter.sol";
import { IBridgeReceiver } from "../../../interfaces/crosschainV3/IBridgeReceiver.sol";

/**
 * @title AbstractAdapter
 * @author Origin Protocol Inc
 *
 * @notice Shared base for OUSD V3 bridge adapters. One adapter deployment serves a single
 *         (chain, bridge protocol) — multi-tenant across strategies on that chain, with per-
 *         sender lane configuration. Under CREATE3 cross-chain parity, the peer adapter on
 *         the destination chain shares this contract's own address, so outbound routing and
 *         inbound trust checks both reference `address(this)`.
 *
 *         The base provides:
 *           - `authorised` whitelist gating both outbound (`msg.sender`) and inbound
 *             (`envelopeSender`); a single authorise call wires both directions.
 *           - `laneConfig[sender]` with destination chain selector, paused flag, and
 *             destination-side gas hint. Concrete adapters extend with their own per-lane
 *             extras as separate mappings.
 *           - Strategists list — accounts that can pause/unpause lanes for fast incident
 *             response. Governor also has these powers.
 *           - Outbound `sendMessage` / `sendMessageAndTokens` that wrap
 *             `(msg.sender, payload)` into a transport envelope and require
 *             `msg.value >= quote`. Excess is NOT refunded — it stays on the adapter
 *             (recover via `transferToken`); see `sendMessage`.
 *           - Inbound helpers `_validateInbound` (transport identity already verified by
 *             the concrete adapter) and `_deliver` (atomic delivery to the destination
 *             strategy).
 *           - A `transferToken` sweep for stuck tokens / native (governor only).
 *
 *         Concrete adapters implement three internal hooks for the bridge-specific transport
 *         calls: `_sendMessage`, `_sendMessageAndTokens`, `_quoteFee`.
 */
abstract contract AbstractAdapter is IBridgeAdapter, Governable {
    using SafeERC20 for IERC20;

    /// @notice Per-lane routing config. One row per authorised sender.
    struct ChainConfig {
        bool paused;
        uint64 chainSelector; // destination chain identifier (protocol-specific encoding)
        uint32 destGasLimit; // gas hint forwarded to the receive callback on the peer
    }

    /// @notice Sender → authorised flag. Gates both outbound `msg.sender` and inbound
    ///         envelopeSender. CREATE3 parity means the same address represents the same
    ///         strategy on every chain it lives on.
    mapping(address => bool) public authorised;

    /// @notice Sender → lane config. Mutating this changes which destination chain the
    ///         sender can send to / be received from; treat as governance-grade.
    mapping(address => ChainConfig) public laneConfig;

    /// @notice Strategists list — actors permitted to flip the `paused` flag on a lane.
    ///         The governor also has these powers.
    mapping(address => bool) public strategists;

    /// @notice Per-tx maximum token amount this adapter accepts on outbound. Governor-set
    ///         to match the bridge protocol's per-tx limit (CCIP token-lane rate, CCTP V2
    ///         per-burn cap, etc.). Strategies on the peer chain treat the same value as
    ///         "max this adapter can deliver inbound per tx" to size their withdrawAll-style
    ///         requests. `0` = no enforcement at this layer (concrete adapters may still
    ///         apply hard protocol-level constants on top).
    /// @dev Backing storage for the `maxTransferAmount()` getter, which concrete adapters may
    ///      override to surface a hard protocol cap (e.g. CCTPAdapter's 10M) regardless of the
    ///      configured value. Internal so the override is the single source of truth externally.
    uint256 internal _maxTransferAmount;

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

    /// @dev Reserved for future expansion of this abstract layer (proxy upgradeable).
    uint256[50] private __gap;

    constructor() {
        // For standalone deployments (tests, scratch). When behind a proxy, the proxy's
        // own constructor + initialize ritual is the source of truth — this assignment is
        // overwritten as soon as the proxy delegates governance through `_changeGovernor`.
        _setGovernor(msg.sender);
    }

    // --- Modifiers ---------------------------------------------------------

    modifier onlyAuthorised() {
        require(authorised[msg.sender], "Adapter: not authorised");
        _;
    }

    modifier onlyStrategistOrGovernor() {
        require(
            strategists[msg.sender] || isGovernor(),
            "Adapter: not strategist or governor"
        );
        _;
    }

    // --- Governance: strategists -------------------------------------------

    function addStrategist(address who) external onlyGovernor {
        require(who != address(0), "Adapter: zero strategist");
        strategists[who] = true;
        emit StrategistAdded(who);
    }

    function removeStrategist(address who) external onlyGovernor {
        strategists[who] = false;
        emit StrategistRemoved(who);
    }

    // --- Governance: authorisation + lane config ---------------------------

    /**
     * @notice Authorise `sender` to use this adapter and register its lane config.
     *         Authorisation is bidirectional: the same `sender` is recognised both as
     *         outbound `msg.sender` and as inbound `envelopeSender`.
     */
    function authorise(address sender, ChainConfig calldata cfg)
        external
        onlyGovernor
    {
        require(sender != address(0), "Adapter: zero sender");
        // chainSelector may be 0 — CCTP V2 domain for Ethereum/Sepolia is literally 0.
        // Authorisation lookup uses the `authorised` flag, not chainSelector, so 0
        // is a valid (non-uninitialised) value here.
        authorised[sender] = true;
        laneConfig[sender] = cfg;
        emit Authorised(sender, cfg);
    }

    function revoke(address sender) external onlyGovernor {
        authorised[sender] = false;
        emit Revoked(sender);
    }

    function setLaneConfig(address sender, ChainConfig calldata cfg)
        external
        onlyGovernor
    {
        require(authorised[sender], "Adapter: sender not authorised");
        // See note in `authorise()` — chainSelector may be 0 (CCTP Ethereum domain).
        laneConfig[sender] = cfg;
        emit LaneConfigUpdated(sender, cfg);
    }

    /// @notice Governor sets the per-tx token amount ceiling. Set to match the bridge
    ///         protocol's actual per-tx limit (CCIP lane rate, CCTP burn cap, etc.).
    ///         `0` disables the check (e.g., canonical bridges with no per-tx limit).
    function setMaxTransferAmount(uint256 _amount) external onlyGovernor {
        emit MaxTransferAmountUpdated(_maxTransferAmount, _amount);
        _maxTransferAmount = _amount;
    }

    /// @notice Per-tx maximum token amount (see `_maxTransferAmount`). `0` = unlimited at this
    ///         layer. Concrete adapters override to surface a hard protocol cap.
    function maxTransferAmount() public view virtual returns (uint256) {
        return _maxTransferAmount;
    }

    /// @notice Per-tx minimum token amount (dust floor). `0` = no floor. Concrete adapters
    ///         that enforce a floor (e.g. CCTPAdapter) override this; default is no floor so
    ///         strategies can quote `[minTransferAmount(), maxTransferAmount()]` generically.
    function minTransferAmount() public view virtual returns (uint256) {
        return 0;
    }

    function pauseLane(address sender) external onlyStrategistOrGovernor {
        require(authorised[sender], "Adapter: sender not authorised");
        laneConfig[sender].paused = true;
        emit LanePaused(sender);
    }

    function unpauseLane(address sender) external onlyStrategistOrGovernor {
        require(authorised[sender], "Adapter: sender not authorised");
        laneConfig[sender].paused = false;
        emit LaneUnpaused(sender);
    }

    // --- Governance: recovery ----------------------------------------------

    /**
     * @notice Sweep a stuck asset (or native via `_asset == address(0)`) to the governor.
     *         Recovery only — used to rescue mistaken sends or drain stale refund balances.
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

    // --- Outbound (IBridgeAdapter) -----------------------------------------

    /// @inheritdoc IBridgeAdapter
    ///
    /// @dev No refund on excess. Overpayment stays on the adapter; recover via
    ///      `transferToken(address(0), amount)` (governor-only). Rationale: refunds
    ///      add code surface, and the strategy quotes fees itself before calling — overpay
    ///      should be rare. Pool-donation semantics are simpler than per-call refund logic.
    function sendMessage(bytes calldata payload)
        external
        payable
        override
        onlyAuthorised
    {
        ChainConfig memory cfg = laneConfig[msg.sender];
        require(!cfg.paused, "Adapter: lane paused");
        bytes memory envelope = _wrap(msg.sender, 0, payload);
        (uint256 fee, , bool requiresExternalPayment) = _quoteFee(
            envelope,
            cfg,
            address(0),
            0
        );
        // requiresExternalPayment == false means the bridge handles its own fee internally
        // (e.g., CCTP V2 auto-deducts from the burn amount); msg.value is not consumed.
        if (requiresExternalPayment) {
            require(msg.value >= fee, "Adapter: insufficient fee");
        }
        _sendMessage(envelope, cfg, requiresExternalPayment ? fee : 0);
        emit MessageSent(msg.sender, address(0), 0, fee);
    }

    /// @inheritdoc IBridgeAdapter
    function sendMessageAndTokens(
        address token,
        uint256 amount,
        bytes calldata payload
    ) external payable override onlyAuthorised {
        require(token != address(0), "Adapter: zero token");
        require(amount > 0, "Adapter: zero amount");
        // Per-tx amount cap. `0` disables the check (canonical bridges, unconfigured).
        // Reject cleanly here rather than letting the bridge router revert deep inside
        // its own validation. Read the virtual getter (not the raw `_maxTransferAmount`
        // field) so a concrete adapter's hard-cap override (e.g. CCTP's 10M) is honoured
        // here even when `_maxTransferAmount` is left at 0.
        uint256 cap = maxTransferAmount();
        require(cap == 0 || amount <= cap, "Adapter: amount above max");
        ChainConfig memory cfg = laneConfig[msg.sender];
        require(!cfg.paused, "Adapter: lane paused");
        bytes memory envelope = _wrap(msg.sender, amount, payload);
        (uint256 fee, , bool requiresExternalPayment) = _quoteFee(
            envelope,
            cfg,
            token,
            amount
        );
        if (requiresExternalPayment) {
            require(msg.value >= fee, "Adapter: insufficient fee");
        }
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        _sendMessageAndTokens(
            token,
            amount,
            envelope,
            cfg,
            requiresExternalPayment ? fee : 0
        );
        emit MessageSent(msg.sender, token, amount, fee);
    }

    /// @inheritdoc IBridgeAdapter
    function quoteFee(
        address token,
        uint256 amount,
        bytes calldata payload
    )
        external
        view
        override
        returns (
            uint256 fee,
            address feeToken,
            bool requiresExternalPayment
        )
    {
        ChainConfig memory cfg = laneConfig[msg.sender];
        bytes memory envelope = _wrap(msg.sender, amount, payload);
        return _quoteFee(envelope, cfg, token, amount);
    }

    // --- Outbound hooks (concrete adapters implement) ----------------------

    /// @dev Send a message-only envelope through the bridge transport. `fee` is the native
    ///      value to attach to the underlying bridge call; 0 when the protocol auto-deducts.
    function _sendMessage(
        bytes memory envelope,
        ChainConfig memory cfg,
        uint256 fee
    ) internal virtual;

    /// @dev Send a message + tokens through the bridge transport. Same `fee` semantics as
    ///      `_sendMessage`.
    function _sendMessageAndTokens(
        address token,
        uint256 amount,
        bytes memory envelope,
        ChainConfig memory cfg,
        uint256 fee
    ) internal virtual;

    /// @dev Compute the fee details for the outbound op. See `IBridgeAdapter.quoteFee` for
    ///      the meaning of each return value. The three-value form lets the strategy
    ///      separate "is action required?" from "what token / how much?" — important for
    ///      bridges like CCTP V2 where the fee is real but auto-deducted (caller takes no
    ///      action) vs CCIP where the caller must supply native.
    function _quoteFee(
        bytes memory envelope,
        ChainConfig memory cfg,
        address token,
        uint256 amount
    )
        internal
        view
        virtual
        returns (
            uint256 fee,
            address feeToken,
            bool requiresExternalPayment
        );

    // --- Inbound helpers (concrete adapter calls from its transport entry) --

    /**
     * @dev Validate an inbound envelope against the configured lane. Concrete adapters
     *      pass:
     *        - `srcChain`        — source chain ID extracted from the bridge transport.
     *        - `transportSender` — source-chain caller that originated the bridge tx. Under
     *                              CREATE3 parity, this must equal `address(this)` (the peer
     *                              adapter has the same address).
     *        - `envelope`        — full wrapped bytes received from the transport.
     *      Returns the decoded `envelopeSender` (also the destination strategy address on
     *      this chain), `intendedAmount` (sender's intent for the token leg; 0 for
     *      message-only), and the strategy-owned `payload`.
     */
    function _validateInbound(
        uint64 srcChain,
        address transportSender,
        bytes memory envelope
    )
        internal
        view
        returns (
            address envelopeSender,
            uint256 intendedAmount,
            bytes memory payload
        )
    {
        (envelopeSender, intendedAmount, payload) = _unwrap(envelope);
        require(authorised[envelopeSender], "Adapter: not authorised");
        ChainConfig memory cfg = laneConfig[envelopeSender];
        require(!cfg.paused, "Adapter: lane paused");
        require(srcChain == cfg.chainSelector, "Adapter: wrong source chain");
        require(
            transportSender == address(this),
            "Adapter: not from peer adapter"
        );
    }

    /**
     * @dev Atomically transfer `amountReceived` of `token` to the target strategy and call
     *      `receiveMessage`. The target strategy address equals `envelopeSender` under
     *      CREATE3 parity.
     */
    function _deliver(
        address envelopeSender,
        address token,
        uint256 amountReceived,
        uint256 feePaid,
        bytes memory payload
    ) internal {
        if (amountReceived > 0 && token != address(0)) {
            IERC20(token).safeTransfer(envelopeSender, amountReceived);
        }
        // feePaid is NOT forwarded to the strategy (no strategy reads it); off-chain
        // consumers read it from the MessageDelivered event below.
        // The call target and the `sender` argument are the same `envelopeSender`: the
        // target == sender under CREATE3 parity (see @dev), and the strategy expects its
        // own peer address as `sender`.
        IBridgeReceiver(envelopeSender).receiveMessage(
            envelopeSender,
            token,
            amountReceived,
            payload
        );
        emit MessageDelivered(envelopeSender, token, amountReceived, feePaid);
    }

    // --- Envelope wrap / unwrap --------------------------------------------

    /// @dev Header byte length: 20 (sender) + 32 (intendedAmount).
    uint256 internal constant HEADER_LENGTH = 52;

    /// @dev Wire envelope: 20-byte `sender` + 32-byte `intendedAmount` + opaque `payload`.
    ///      `intendedAmount` is the token leg the sender intends to land on the destination
    ///      (0 for message-only). The receiving adapter compares against the actual landed
    ///      amount to surface any transport-side fee delta to the strategy.
    function _wrap(
        address sender,
        uint256 intendedAmount,
        bytes memory payload
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(sender, intendedAmount, payload);
    }

    /// @dev Inverse of `_wrap`. Reverts when the envelope is shorter than the header.
    function _unwrap(bytes memory envelope)
        internal
        pure
        returns (
            address sender,
            uint256 intendedAmount,
            bytes memory payload
        )
    {
        require(envelope.length >= HEADER_LENGTH, "Adapter: bad envelope");
        // Load first 20 bytes as address.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sender := shr(96, mload(add(envelope, 32)))
            // intendedAmount lives at offset 20; mload reads 32 bytes from there.
            intendedAmount := mload(add(envelope, 52))
        }
        // Copy the remainder into a new bytes buffer.
        uint256 payloadLength = envelope.length - HEADER_LENGTH;
        payload = new bytes(payloadLength);
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let src := add(envelope, 84) // 32-byte length + 20 sender + 32 amount
            let dst := add(payload, 32)
            for {
                let i := 0
            } lt(i, payloadLength) {
                i := add(i, 32)
            } {
                mstore(add(dst, i), mload(add(src, i)))
            }
        }
    }

    // --- Native receive ----------------------------------------------------

    /// @dev Accepts native ETH (e.g., refunds from underlying transports). Concrete adapters
    ///      may override to add behaviour (e.g., SuperbridgeAdapter wrapping incoming bridge
    ///      ETH to WETH on the L2 side).
    receive() external payable virtual {}
}
