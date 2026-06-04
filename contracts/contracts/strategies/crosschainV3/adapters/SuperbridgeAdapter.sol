// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
// solhint-disable-next-line max-line-length
import { IAny2EVMMessageReceiver } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IAny2EVMMessageReceiver.sol";

import { IWETH9 } from "../../../interfaces/IWETH9.sol";
import { ISplitInboundAdapter } from "../../../interfaces/crosschainV3/ISplitInboundAdapter.sol";
import { AbstractAdapter } from "./AbstractAdapter.sol";
import { CrossChainV3Helper } from "../CrossChainV3Helper.sol";
import { CCIPMessageBuilder } from "../libraries/CCIPMessageBuilder.sol";
import { NativeFeeHelper } from "../libraries/NativeFeeHelper.sol";

interface IL1StandardBridge {
    /// @notice OP Stack canonical bridge ETH deposit. Native ETH arrives at `_to` on the L2.
    function bridgeETHTo(
        address _to,
        uint32 _minGasLimit,
        bytes calldata _extraData
    ) external payable;
}

/**
 * @title SuperbridgeAdapter
 * @author Origin Protocol Inc
 *
 * @notice Split-delivery bidirectional adapter for Ethereum ↔ OP-Stack-L2, specialised to
 *         ETH only.
 *
 *           - Outbound (Ethereum → L2): take WETH from the calling strategy, unwrap to
 *             native ETH, send it via `L1StandardBridge.bridgeETHTo{value: amount}(...)`.
 *             A separate CCIP message-only send carries the V3 envelope.
 *           - Inbound (L2 receives from Ethereum): the canonical bridge credits native ETH
 *             to this adapter's address. `receive()` wraps it back to WETH so the destination
 *             strategy (which uses `bridgeAsset = WETH`) gets the asset shape it expects.
 *             The CCIP message lands via `ccipReceive`; if the WETH balance hasn't yet
 *             reached `expectedAmount`, the message is held in a pending slot until
 *             `processStoredMessage(target)` finalises.
 *
 *         Same contract code on both chains; deployment role is determined by `_l1`:
 *           - `_l1 != address(0)` (Ethereum, outbound-only): `receive()` keeps incoming ETH
 *             raw so it can fund CCIP fees via `_consumeNativeFee`. Inbound entry points
 *             aren't expected to be exercised.
 *           - `_l1 == address(0)` (L2, inbound-only): `receive()` wraps incoming ETH to WETH.
 *             Outbound entry points revert at call time.
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

    /// @notice Local WETH on this chain. Required on both deployment roles: the L1 side
    ///         unwraps before calling `bridgeETHTo`, the L2 side wraps incoming bridge ETH.
    address public immutable weth;

    /// @notice Per-sender CCIP message destination gas limit.
    mapping(address => uint256) public destGasLimitFor;

    /// @notice Per-sender canonical bridge minimum gas hint (typically 200k for OP Stack).
    mapping(address => uint32) public canonicalMinGasFor;

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

    constructor(
        IL1StandardBridge _l1,
        IRouterClient _ccip,
        address _weth
    ) {
        require(address(_ccip) != address(0), "Super: zero CCIP");
        require(_weth != address(0), "Super: zero WETH");
        l1StandardBridge = _l1;
        ccipRouter = _ccip;
        weth = _weth;
    }

    modifier onlyRouter() {
        require(msg.sender == address(ccipRouter), "Super: not router");
        _;
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

    /**
     * @notice Auto-wrap incoming ETH on the L2-side deployment so bridge ETH becomes WETH
     *         immediately (the destination strategy expects WETH). On the L1-side deployment
     *         keep ETH raw — it's CCIP fee top-up budget consumed by `_consumeNativeFee`.
     */
    receive() external payable override {
        if (msg.value > 0 && address(l1StandardBridge) == address(0)) {
            IWETH9(weth).deposit{ value: msg.value }();
        }
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
        require(token == weth, "Super: token must be WETH");
        require(amount > 0, "Super: zero amount");

        // Pull WETH from the sender and unwrap to native ETH for the canonical bridge.
        IERC20(weth).safeTransferFrom(msg.sender, address(this), amount);
        IWETH9(weth).withdraw(amount);

        // Leg 1: canonical bridge — carry native ETH to the peer adapter on the L2.
        l1StandardBridge.bridgeETHTo{ value: amount }(
            peerReceiver,
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

        // Determine the token amount the message expects to find on this adapter once the
        // canonical bridge tokens land. For message-only types, expectedAmount = 0.
        uint256 expectedAmount = _expectedAmountFor(uint8(msgType), payload);

        // CREATE2 parity: destination strategy on this chain == envelope sender.
        if (
            expectedAmount == 0 ||
            IERC20(weth).balanceOf(address(this)) >= expectedAmount
        ) {
            _deliverAtomic(
                envelopeSender,
                nonce,
                expectedAmount,
                uint8(msgType),
                payload,
                expectedAmount > 0 ? weth : address(0)
            );
        } else {
            _storePending(
                envelopeSender,
                nonce,
                expectedAmount,
                uint8(msgType),
                payload,
                weth
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
