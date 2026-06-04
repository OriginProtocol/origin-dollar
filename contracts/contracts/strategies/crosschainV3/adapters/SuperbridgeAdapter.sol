// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
// solhint-disable-next-line max-line-length
import { IAny2EVMMessageReceiver } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IAny2EVMMessageReceiver.sol";

import { ISplitInboundAdapter } from "../../../interfaces/crosschainV3/ISplitInboundAdapter.sol";
import { AbstractAdapter } from "./AbstractAdapter.sol";
import { CrossChainV3Helper } from "../CrossChainV3Helper.sol";
import { CCIPMessageBuilder } from "../libraries/CCIPMessageBuilder.sol";
import { NativeFeeHelper } from "../libraries/NativeFeeHelper.sol";

interface IL1StandardBridge {
    /// @notice OP Stack canonical bridge ERC20 deposit. Tokens arrive at `_to` on the L2.
    function bridgeERC20To(
        address _localToken,
        address _remoteToken,
        address _to,
        uint256 _amount,
        uint32 _minGasLimit,
        bytes calldata _extraData
    ) external;
}

/**
 * @title SuperbridgeAdapter
 * @author Origin Protocol Inc
 *
 * @notice Split-delivery bidirectional adapter for Ethereum ↔ OP-Stack-L2.
 *
 *           - Outbound (Ethereum → L2): tokens travel via the OP Stack canonical
 *             `L1StandardBridge` (free, but token-only), the message envelope travels
 *             separately via Chainlink CCIP. Both arrive on the L2 at this adapter's peer.
 *           - Inbound (L2 receiving from Ethereum): the CCIP `ccipReceive` lands here with
 *             the envelope; canonical bridge transfers tokens directly to this adapter
 *             address with no callback. We hold the message in a per-target pending slot
 *             until tokens arrive; off-chain automation calls `processStoredMessage(target)`
 *             to finalise once both legs have landed.
 *
 *         Standalone — does NOT extend `CCIPAdapter` because the outbound token path
 *         (canonical bridge, not CCIP) and inbound delivery (split, not atomic) diverge
 *         enough that the inherited code would be entirely overridden.
 */
contract SuperbridgeAdapter is
    AbstractAdapter,
    IAny2EVMMessageReceiver,
    IERC165,
    ISplitInboundAdapter
{
    using SafeERC20 for IERC20;

    IL1StandardBridge public immutable l1StandardBridge;
    IRouterClient public immutable ccipRouter;

    /// @notice L2 token address corresponding to `localToken`. OP Stack canonical bridge
    ///         needs this to mint on the destination chain.
    mapping(address => address) public remoteTokenOf;

    /// @notice Per-sender CCIP message destination gas limit.
    mapping(address => uint256) public destGasLimitFor;

    /// @notice Per-sender canonical bridge minimum gas hint (typically 200k for OP Stack).
    mapping(address => uint32) public canonicalMinGasFor;

    /// @notice Token expected to land via the canonical bridge for inbound split delivery.
    address public immutable expectedToken;

    struct PendingMessage {
        bool exists;
        uint64 nonce;
        uint256 expectedAmount;
        uint8 messageType;
        bytes payload;
        address token;
        address target;
    }

    /// @notice Per-target pending split-delivery slot.
    mapping(address => PendingMessage) internal pendingFor;

    event RemoteTokenMapped(address localToken, address remoteToken);
    event DestGasLimitConfigured(address sender, uint256 destGasLimit);
    event CanonicalMinGasConfigured(address sender, uint32 canonicalMinGas);
    event MessageStored(
        address indexed target,
        uint64 nonce,
        uint8 messageType,
        uint256 expectedAmount
    );
    event AdaptedPendingMessageFromOldAdapter(
        address indexed oldAdapter,
        address indexed target
    );

    /**
     * @dev `_l1` is required only on the Ethereum-side deploy (outbound). `_expectedToken`
     *      is required only on the L2-side deploy (inbound). Each side can pass
     *      `address(0)` for the field it doesn't use; the corresponding entry points
     *      revert at call time when the field is missing.
     */
    constructor(
        IL1StandardBridge _l1,
        IRouterClient _ccip,
        address _expectedToken
    ) {
        require(address(_ccip) != address(0), "Super: zero CCIP");
        l1StandardBridge = _l1;
        ccipRouter = _ccip;
        expectedToken = _expectedToken;
    }

    modifier onlyRouter() {
        require(msg.sender == address(ccipRouter), "Super: not router");
        _;
    }

    function mapRemoteToken(address _localToken, address _remoteToken)
        external
        onlyGovernor
    {
        remoteTokenOf[_localToken] = _remoteToken;
        emit RemoteTokenMapped(_localToken, _remoteToken);
    }

    function setDestGasLimit(address _sender, uint256 _gasLimit)
        external
        onlyGovernor
    {
        destGasLimitFor[_sender] = _gasLimit;
        emit DestGasLimitConfigured(_sender, _gasLimit);
    }

    function setCanonicalMinGas(address _sender, uint32 _g)
        external
        onlyGovernor
    {
        canonicalMinGasFor[_sender] = _g;
        emit CanonicalMinGasConfigured(_sender, _g);
    }

    // --- IOutboundAdapter ---------------------------------------------------

    function estimateFee(uint256, bytes calldata message)
        external
        view
        override
        returns (uint256 nativeFee, uint256 tokenFee)
    {
        Client.EVM2AnyMessage memory ccipMessage = CCIPMessageBuilder.build(
            address(0),
            0,
            message,
            peerReceiverFor[msg.sender],
            destGasLimitFor[msg.sender]
        );
        nativeFee = ccipRouter.getFee(destinationFor[msg.sender], ccipMessage);
        tokenFee = 0;
    }

    function _sendTokensAndMessage(
        address token,
        uint256 amount,
        bytes calldata message,
        uint64 destination,
        address peerReceiver
    ) internal override {
        require(
            address(l1StandardBridge) != address(0),
            "Super: outbound unsupported"
        );
        require(amount > 0, "Super: zero amount");
        address remoteToken = remoteTokenOf[token];
        require(remoteToken != address(0), "Super: remote token unmapped");

        // Leg 1: canonical bridge — pull tokens from the sender and bridge to the peer
        // adapter on the L2.
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(token).safeApprove(address(l1StandardBridge), amount);
        l1StandardBridge.bridgeERC20To(
            token,
            remoteToken,
            peerReceiver,
            amount,
            canonicalMinGasFor[msg.sender],
            ""
        );

        // Leg 2: CCIP message-only.
        _sendCCIPMessage(message, destination, peerReceiver);
    }

    function _sendMessage(
        bytes calldata message,
        uint64 destination,
        address peerReceiver
    ) internal override {
        _sendCCIPMessage(message, destination, peerReceiver);
    }

    function _sendCCIPMessage(
        bytes memory message,
        uint64 destination,
        address peerReceiver
    ) internal {
        Client.EVM2AnyMessage memory ccipMessage = CCIPMessageBuilder.build(
            address(0),
            0,
            message,
            peerReceiver,
            destGasLimitFor[msg.sender]
        );
        uint256 fee = ccipRouter.getFee(destination, ccipMessage);
        NativeFeeHelper.consume(fee);
        ccipRouter.ccipSend{ value: fee }(destination, ccipMessage);
    }

    // --- Inbound (IAny2EVMMessageReceiver + split delivery) ----------------

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId)
        external
        pure
        override
        returns (bool)
    {
        return
            interfaceId == type(IAny2EVMMessageReceiver).interfaceId ||
            interfaceId == type(IERC165).interfaceId;
    }

    /// @inheritdoc IAny2EVMMessageReceiver
    function ccipReceive(Client.Any2EVMMessage calldata message)
        external
        override
        onlyRouter
    {
        (
            uint32 msgType,
            uint64 nonce,
            address envelopeSender,
            bytes memory payload
        ) = _unwrapAndValidate(message.data);
        require(expectedToken != address(0), "Super: inbound unsupported");

        // Determine the token amount the message expects to find on this adapter once the
        // canonical bridge tokens land. For message-only types, expectedAmount = 0.
        uint256 expectedAmount = _expectedAmountFor(uint8(msgType), payload);

        // CREATE2 parity: destination strategy on this chain == envelope sender.
        if (
            expectedAmount == 0 ||
            IERC20(expectedToken).balanceOf(address(this)) >= expectedAmount
        ) {
            _deliverAtomic(
                envelopeSender,
                nonce,
                expectedAmount,
                uint8(msgType),
                payload,
                expectedAmount > 0 ? expectedToken : address(0)
            );
        } else {
            _storePending(
                envelopeSender,
                nonce,
                expectedAmount,
                uint8(msgType),
                payload,
                expectedToken
            );
        }
    }

    /// @inheritdoc ISplitInboundAdapter
    function hasPendingMessage(address _target)
        external
        view
        override
        returns (bool)
    {
        return pendingFor[_target].exists;
    }

    /// @inheritdoc ISplitInboundAdapter
    function processStoredMessage(address _target) external override {
        PendingMessage memory p = pendingFor[_target];
        require(p.exists, "Super: nothing pending");
        if (p.expectedAmount > 0 && p.token != address(0)) {
            require(
                IERC20(p.token).balanceOf(address(this)) >= p.expectedAmount,
                "Super: tokens not yet landed"
            );
        }
        delete pendingFor[_target];
        _deliverAtomic(
            p.target,
            p.nonce,
            p.expectedAmount,
            p.messageType,
            p.payload,
            p.token
        );
    }

    /**
     * @notice Adopt a pending message from a previous adapter during a governance-driven
     *         adapter swap. The old adapter must `approve` this contract for the token
     *         amount it holds; we pull the tokens and copy the pending slot under the
     *         right target.
     */
    function adoptPendingMessage(
        address _oldAdapter,
        PendingMessage calldata _pending
    ) external onlyGovernor {
        require(_pending.target != address(0), "Super: zero target");
        require(!pendingFor[_pending.target].exists, "Super: already pending");
        if (_pending.token != address(0) && _pending.expectedAmount > 0) {
            IERC20(_pending.token).safeTransferFrom(
                _oldAdapter,
                address(this),
                _pending.expectedAmount
            );
        }
        pendingFor[_pending.target] = _pending;
        pendingFor[_pending.target].exists = true;
        emit MessageStored(
            _pending.target,
            _pending.nonce,
            _pending.messageType,
            _pending.expectedAmount
        );
        emit AdaptedPendingMessageFromOldAdapter(_oldAdapter, _pending.target);
    }

    function _storePending(
        address target,
        uint64 nonce,
        uint256 expectedAmount,
        uint8 messageType,
        bytes memory payload,
        address token
    ) internal {
        require(!pendingFor[target].exists, "Super: slot busy");
        pendingFor[target] = PendingMessage({
            exists: true,
            nonce: nonce,
            expectedAmount: expectedAmount,
            messageType: messageType,
            payload: payload,
            token: token,
            target: target
        });
        emit MessageStored(target, nonce, messageType, expectedAmount);
    }

    /**
     * @dev Of all yield-channel messages that travel R→M (Remote on Ethereum → Master on
     *      an OP-Stack L2), only `WITHDRAW_CLAIM_ACK` carries the bridgeAsset back to
     *      Master. Other R→M messages are message-only.
     *
     *      The exact delivered amount is encoded inside the `WITHDRAW_CLAIM_ACK` payload
     *      (`abi.encode(newBalance, success, amount)`); we pin `expectedAmount` to it.
     */
    function _expectedAmountFor(uint8 msgType, bytes memory payload)
        internal
        pure
        returns (uint256)
    {
        if (msgType == uint8(CrossChainV3Helper.WITHDRAW_CLAIM_ACK)) {
            (, bool success, uint256 amount) = CrossChainV3Helper
                .decodeWithdrawClaimAckPayload(payload);
            return success ? amount : 0;
        }
        return 0;
    }
}
