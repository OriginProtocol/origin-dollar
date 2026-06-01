// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICCTPTokenMessenger, ICCTPMessageTransmitter } from "../../../interfaces/cctp/ICCTP.sol";
import { AbstractOutboundAdapter } from "./AbstractOutboundAdapter.sol";

/**
 * @title CCTPOutboundAdapter
 * @author Origin Protocol Inc
 *
 * @notice Atomic outbound adapter over Circle CCTP V2. Carries USDC + an arbitrary message
 *         body via `depositForBurnWithHook`, or message-only via `sendMessage`. The receiver
 *         adapter on the destination chain is recovered from the `destinationCaller` slot.
 *
 *         Authorisation surface is inherited from `AbstractOutboundAdapter`: only sender
 *         strategies the governor has authorised may invoke send functions.
 */
contract CCTPOutboundAdapter is AbstractOutboundAdapter {
    using SafeERC20 for IERC20;

    /// @notice USDC on this chain.
    address public immutable usdcToken;
    /// @notice Circle CCTP V2 Token Messenger.
    ICCTPTokenMessenger public immutable tokenMessenger;
    /// @notice Circle CCTP V2 Message Transmitter (for message-only sends).
    ICCTPMessageTransmitter public immutable messageTransmitter;

    /// @notice Minimum finality threshold sent on every transfer (>= 2000 = finalized).
    uint32 public minFinalityThreshold = 2000;

    constructor(
        address _usdcToken,
        ICCTPTokenMessenger _tokenMessenger,
        ICCTPMessageTransmitter _messageTransmitter
    ) {
        require(_usdcToken != address(0), "CCTPOut: zero usdc");
        require(
            address(_tokenMessenger) != address(0),
            "CCTPOut: zero messenger"
        );
        require(
            address(_messageTransmitter) != address(0),
            "CCTPOut: zero transmitter"
        );
        usdcToken = _usdcToken;
        tokenMessenger = _tokenMessenger;
        messageTransmitter = _messageTransmitter;
    }

    function setMinFinalityThreshold(uint32 _t) external onlyGovernor {
        require(_t >= 1000 && _t <= 2000, "CCTPOut: bad threshold");
        minFinalityThreshold = _t;
    }

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
        require(token == usdcToken, "CCTPOut: token must be usdc");

        // Pull USDC from the sender strategy and approve the token messenger.
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(token).safeApprove(address(tokenMessenger), amount);

        uint256 maxFee = tokenMessenger.getMinFeeAmount(amount);
        tokenMessenger.depositForBurnWithHook(
            amount,
            uint32(destination),
            _addressToBytes32(peerReceiver),
            token,
            _addressToBytes32(peerReceiver),
            maxFee,
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
}
