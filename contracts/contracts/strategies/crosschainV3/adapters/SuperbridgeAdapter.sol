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
import { CCIPMessageBuilder } from "../libraries/CCIPMessageBuilder.sol";

interface IL1StandardBridge {
    /// @notice OP Stack canonical bridge ETH deposit. Native ETH arrives at `_to` on L2.
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
 * @notice Split-delivery bidirectional adapter for Ethereum ↔ OP-Stack-L2, ETH-only.
 *           - Outbound (Ethereum → L2): take WETH from the calling strategy, unwrap to native
 *             ETH, send via `L1StandardBridge.bridgeETHTo{value: amount}(...)`. A separate
 *             CCIP message-only send carries the V3 envelope (sender + intendedAmount +
 *             payload).
 *           - Inbound (L2 receives from Ethereum): the canonical bridge credits native ETH
 *             to this adapter's address. `receive()` wraps it back to WETH so the destination
 *             strategy (which uses `bridgeAsset = WETH`) gets the asset shape it expects.
 *             The CCIP message lands via `ccipReceive`; if WETH balance < intendedAmount, the
 *             message is held in a pending slot until `processStoredMessage(target)`.
 *
 *         Same contract code on both chains; deployment role is set by `_l1`:
 *           - `_l1 != address(0)` (Ethereum, outbound-only): `receive()` keeps incoming ETH
 *             raw — used as a CCIP-fee top-up reserve only when needed. Inbound entry points
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

    /// @notice Local WETH on this chain. Required on both deployment roles: L1 side unwraps
    ///         before calling `bridgeETHTo`; L2 side wraps incoming bridge ETH.
    address public immutable weth;

    /// @notice Per-sender canonical bridge minimum gas hint (typically 200k for OP Stack).
    mapping(address => uint32) public canonicalMinGasFor;

    struct PendingMessage {
        bool exists;
        uint256 intendedAmount;
        bytes payload;
        address target;
    }

    /// @notice Per-target pending split-delivery slot.
    mapping(address => PendingMessage) internal pendingFor;

    event CanonicalMinGasConfigured(address sender, uint32 canonicalMinGas);
    event MessageStored(address indexed target, uint256 intendedAmount);
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

    function setCanonicalMinGas(address _sender, uint32 _g)
        external
        onlyGovernor
    {
        canonicalMinGasFor[_sender] = _g;
        emit CanonicalMinGasConfigured(_sender, _g);
    }

    /**
     * @notice Auto-wrap incoming ETH on the L2-side deployment so bridge ETH becomes WETH
     *         immediately. L1-side deployment keeps ETH raw (used as fee top-up reserve).
     */
    receive() external payable override {
        if (msg.value > 0 && address(l1StandardBridge) == address(0)) {
            IWETH9(weth).deposit{ value: msg.value }();
        }
    }

    // --- Outbound hooks ----------------------------------------------------

    /// @dev Outbound (L1-side): CCIP charges native for the message leg. Canonical bridge
    ///      itself takes no fee. Token-carrying sends use the same CCIP message leg, so the
    ///      fee is the same regardless of whether tokens accompany.
    ///
    ///      Inbound-only deployment (`_l1 == 0`) never has this called for an actual send
    ///      (outbound reverts in `_sendMessageAndTokens`), but we still return a sensible
    ///      value for off-chain quoting.
    function _quoteFee(
        bytes memory envelope,
        ChainConfig memory cfg,
        address, // token
        uint256 // amount
    )
        internal
        view
        override
        returns (
            uint256 fee,
            address feeToken,
            bool requiresExternalPayment
        )
    {
        Client.EVM2AnyMessage memory ccipMessage = CCIPMessageBuilder.build(
            address(0),
            0,
            envelope,
            address(this),
            cfg.destGasLimit
        );
        fee = ccipRouter.getFee(cfg.chainSelector, ccipMessage);
        feeToken = address(0); // native
        requiresExternalPayment = true;
    }

    function _sendMessage(
        bytes memory envelope,
        ChainConfig memory cfg,
        uint256 fee
    ) internal override {
        require(
            address(l1StandardBridge) != address(0) ||
                address(l1StandardBridge) == address(0),
            "Super: invalid role"
        );
        _sendCCIPMessage(envelope, cfg, fee);
    }

    function _sendMessageAndTokens(
        address token,
        uint256 amount,
        bytes memory envelope,
        ChainConfig memory cfg,
        uint256 fee
    ) internal override {
        require(
            address(l1StandardBridge) != address(0),
            "Super: outbound unsupported"
        );
        require(token == weth, "Super: token must be WETH");

        // WETH already pulled by AbstractAdapter.sendMessageAndTokens — unwrap to ETH.
        IWETH9(weth).withdraw(amount);

        // Leg 1: canonical bridge — carry native ETH to the peer adapter on L2.
        l1StandardBridge.bridgeETHTo{ value: amount }(
            address(this),
            canonicalMinGasFor[msg.sender],
            ""
        );

        // Leg 2: CCIP message-only carrying the envelope.
        _sendCCIPMessage(envelope, cfg, fee);
    }

    function _sendCCIPMessage(
        bytes memory envelope,
        ChainConfig memory cfg,
        uint256 fee
    ) internal {
        Client.EVM2AnyMessage memory ccipMessage = CCIPMessageBuilder.build(
            address(0),
            0,
            envelope,
            address(this),
            cfg.destGasLimit
        );
        ccipRouter.ccipSend{ value: fee }(cfg.chainSelector, ccipMessage);
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
        address transportSender = abi.decode(message.sender, (address));

        (
            address envelopeSender,
            uint256 intendedAmount,
            bytes memory payload
        ) = _validateInbound(
                message.sourceChainSelector,
                transportSender,
                message.data
            );

        // Message-only or tokens already landed — atomic delivery.
        if (
            intendedAmount == 0 ||
            IERC20(weth).balanceOf(address(this)) >= intendedAmount
        ) {
            _deliver(
                envelopeSender,
                intendedAmount > 0 ? weth : address(0),
                intendedAmount,
                0,
                payload
            );
            return;
        }

        // Token leg not landed yet — store the message for later finalisation.
        _storePending(envelopeSender, intendedAmount, payload);
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
        require(
            IERC20(weth).balanceOf(address(this)) >= p.intendedAmount,
            "Super: tokens not yet landed"
        );
        delete pendingFor[_target];
        _deliver(p.target, weth, p.intendedAmount, 0, p.payload);
    }

    /**
     * @notice Adopt a pending message from a previous adapter during a governance-driven
     *         adapter swap. The old adapter must `approve` this contract for the WETH it
     *         holds; we pull the WETH and copy the pending slot under the right target.
     */
    function adoptPendingMessage(
        address _oldAdapter,
        PendingMessage calldata _pending
    ) external onlyGovernor {
        require(_pending.target != address(0), "Super: zero target");
        require(!pendingFor[_pending.target].exists, "Super: already pending");
        if (_pending.intendedAmount > 0) {
            IERC20(weth).safeTransferFrom(
                _oldAdapter,
                address(this),
                _pending.intendedAmount
            );
        }
        pendingFor[_pending.target] = _pending;
        pendingFor[_pending.target].exists = true;
        emit MessageStored(_pending.target, _pending.intendedAmount);
        emit AdaptedPendingMessageFromOldAdapter(_oldAdapter, _pending.target);
    }

    function _storePending(
        address target,
        uint256 intendedAmount,
        bytes memory payload
    ) internal {
        require(!pendingFor[target].exists, "Super: slot busy");
        pendingFor[target] = PendingMessage({
            exists: true,
            intendedAmount: intendedAmount,
            payload: payload,
            target: target
        });
        emit MessageStored(target, intendedAmount);
    }
}
