// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICCTPTokenMessenger, ICCTPMessageTransmitter, IMessageHandlerV2 } from "../../../interfaces/cctp/ICCTP.sol";
import { AbstractAdapter } from "./AbstractAdapter.sol";
import { CrossChainV3Helper } from "../CrossChainV3Helper.sol";

/**
 * @title CCTPAdapter
 * @author Origin Protocol Inc
 *
 * @notice Atomic bidirectional adapter over Circle CCTP V2.
 *           - Outbound: `sendTokensAndMessage` burns USDC + the protocol fee via
 *             `depositForBurnWithHook` so the recipient is credited exactly `amount`.
 *             `sendMessage` posts via the message transmitter.
 *           - Inbound: CCTP MessageTransmitter calls `handleReceiveFinalizedMessage` after
 *             attestation clears. We decode the V3 envelope, validate the sender against
 *             the whitelist, and forward to the destination strategy (CreateX parity:
 *             envelope sender == destination strategy on this chain).
 *
 *         Fees are deducted from the burn amount (USDC, not native). With the default
 *         `minFinalityThreshold = 2000` (finalised) the protocol fee is 0; fast finality
 *         (1000–1999) charges a nonzero fee that the sender supplies on top of `amount`.
 */
contract CCTPAdapter is AbstractAdapter, IMessageHandlerV2 {
    using SafeERC20 for IERC20;

    /// @notice USDC on this chain.
    address public immutable usdcToken;
    /// @notice Circle CCTP V2 Token Messenger.
    ICCTPTokenMessenger public immutable tokenMessenger;
    /// @notice Circle CCTP V2 Message Transmitter (for message-only sends and inbound).
    ICCTPMessageTransmitter public immutable messageTransmitter;

    /// @notice Minimum finality threshold sent on every transfer (>= 2000 = finalised).
    uint32 public minFinalityThreshold = 2000;

    constructor(
        address _usdcToken,
        ICCTPTokenMessenger _tokenMessenger,
        ICCTPMessageTransmitter _messageTransmitter
    ) {
        require(_usdcToken != address(0), "CCTP: zero usdc");
        require(address(_tokenMessenger) != address(0), "CCTP: zero messenger");
        require(
            address(_messageTransmitter) != address(0),
            "CCTP: zero transmitter"
        );
        usdcToken = _usdcToken;
        tokenMessenger = _tokenMessenger;
        messageTransmitter = _messageTransmitter;
    }

    modifier onlyCCTP() {
        require(
            msg.sender == address(messageTransmitter),
            "CCTP: not message transmitter"
        );
        _;
    }

    function setMinFinalityThreshold(uint32 _t) external onlyGovernor {
        require(_t >= 1000 && _t <= 2000, "CCTP: bad threshold");
        minFinalityThreshold = _t;
    }

    // --- IOutboundAdapter ---------------------------------------------------

    /**
     * @notice Fee estimate for a CCTP V2 transfer.
     * @dev `tokenFee` is USDC the sender must supply *in addition to* `amount` so that the
     *      destination receives exactly `amount`. CCTP V2 burns `amount + fee` on the source
     *      and credits `amount` on the destination after deducting `fee`. With the default
     *      `minFinalityThreshold = 2000` (finalised) the protocol fee is 0; for fast finality
     *      (1000–1999) it's nonzero.
     */
    function estimateFee(uint256 amount, bytes calldata)
        external
        view
        override
        returns (uint256 nativeFee, uint256 tokenFee)
    {
        nativeFee = 0;
        tokenFee = amount == 0 ? 0 : tokenMessenger.getMinFeeAmount(amount);
    }

    function _sendTokensAndMessage(
        address token,
        uint256 amount,
        bytes calldata message,
        uint64 destination,
        address peerReceiver
    ) internal override {
        require(token == usdcToken, "CCTP: token must be usdc");

        // CCTP V2 deducts the fee from the burn amount before crediting the recipient. To
        // deliver exactly `amount` on the destination, pull `amount + fee` from the sender.
        // With finalised threshold the fee is 0 and burnAmount == amount.
        uint256 fee = tokenMessenger.getMinFeeAmount(amount);
        uint256 burnAmount = amount + fee;

        IERC20(token).safeTransferFrom(msg.sender, address(this), burnAmount);
        IERC20(token).safeApprove(address(tokenMessenger), burnAmount);

        tokenMessenger.depositForBurnWithHook(
            burnAmount,
            uint32(destination),
            _addressToBytes32(peerReceiver),
            token,
            _addressToBytes32(peerReceiver),
            fee,
            minFinalityThreshold,
            message
        );
    }

    function _sendMessage(
        bytes calldata message,
        uint64 destination,
        address peerReceiver
    ) internal override {
        messageTransmitter.sendMessage(
            uint32(destination),
            _addressToBytes32(peerReceiver),
            _addressToBytes32(peerReceiver),
            minFinalityThreshold,
            message
        );
    }

    function _addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    // --- Inbound (IMessageHandlerV2) ---------------------------------------

    /// @inheritdoc IMessageHandlerV2
    function handleReceiveFinalizedMessage(
        uint32, // sourceDomain (CCTP transport sender; not used — we trust the envelope sender)
        bytes32, // sender
        uint32, // finalityThresholdExecuted
        bytes calldata messageBody
    ) external override onlyCCTP returns (bool) {
        _validateAndDeliver(messageBody);
        return true;
    }

    /// @inheritdoc IMessageHandlerV2
    function handleReceiveUnfinalizedMessage(
        uint32, // sourceDomain
        bytes32, // sender
        uint32, // finalityThresholdExecuted
        bytes calldata // messageBody
    ) external pure override returns (bool) {
        // V3 protocol requires finalised messages only.
        revert("CCTP: unfinalised not accepted");
    }

    function _validateAndDeliver(bytes calldata messageBody) internal {
        (
            uint32 msgType,
            uint64 nonce,
            address envelopeSender,
            bytes memory payload
        ) = _unwrapAndValidate(messageBody);

        // USDC has been minted to this adapter by CCTP. Use the local balance to determine
        // the delivered amount (atomic delivery, so balance reflects what arrived with
        // this msg). CREATE2 parity: destination strategy on this chain == envelope sender.
        uint256 amount = IERC20(usdcToken).balanceOf(address(this));
        _deliverAtomic(
            envelopeSender,
            nonce,
            amount,
            uint8(msgType),
            payload,
            usdcToken
        );
    }
}
