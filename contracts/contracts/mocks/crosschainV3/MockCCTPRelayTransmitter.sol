// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ICCTPMessageTransmitter, IMessageHandlerV2 } from "../../interfaces/cctp/ICCTP.sol";
import { BytesHelper } from "../../utils/BytesHelper.sol";

interface IMintableUSDC {
    function mintTo(address to, uint256 amount) external;
}

/**
 * @title MockCCTPRelayTransmitter
 * @author Origin Protocol Inc
 *
 * @notice TEST-ONLY minimal mock of `ICCTPMessageTransmitter` focused on the relay path.
 *         Supports two modes:
 *
 *           1. **Pure-message** — when the transport `sender` is NOT the registered
 *              token messenger, the mock decodes the transport header and calls back into
 *              the recipient adapter's `handleReceiveFinalizedMessage` with the body as
 *              messageBody. Simulates `MessageTransmitter.sendMessage`.
 *
 *           2. **Burn-and-hook** — when the transport `sender` IS the registered token
 *              messenger, the mock decodes the burn body, mints USDC to the `mintRecipient`
 *              field, and returns success WITHOUT invoking any hook callback. This mirrors
 *              CCTP V2.0 behaviour (no auto-callback for burn messages). The
 *              `CCTPAdapter.relay()` is expected to parse the burn body itself and
 *              dispatch.
 */
contract MockCCTPRelayTransmitter is ICCTPMessageTransmitter {
    using BytesHelper for bytes;

    // Transport header offsets (must match CCTPMessageHelper).
    uint256 private constant SOURCE_DOMAIN_INDEX = 4;
    uint256 private constant SENDER_INDEX = 44;
    uint256 private constant RECIPIENT_INDEX = 76;
    uint256 private constant MESSAGE_BODY_INDEX = 148;

    // Burn-body offsets (must match CCTPMessageHelper).
    uint256 private constant BURN_BODY_MINT_RECIPIENT_INDEX = 36;
    uint256 private constant BURN_BODY_AMOUNT_INDEX = 68;
    uint256 private constant BURN_BODY_FEE_EXECUTED_INDEX = 164;

    /// @notice When `false`, `receiveMessage` returns `false` without forwarding.
    bool public shouldSucceed = true;

    /// @notice When non-zero, transport `sender == tokenMessenger` triggers the burn path.
    address public tokenMessenger;

    /// @notice USDC mock to mint from (must support `mint(to, amount)`).
    address public usdcToMint;

    /// @notice Spy on the last `sendMessage` call (outbound side, not tested here).
    bytes public lastSentMessage;

    event MessageForwarded(
        address indexed recipient,
        uint32 sourceDomain,
        address sender
    );
    event BurnMessageMinted(
        address indexed mintRecipient,
        uint256 amount,
        uint256 feeExecuted
    );

    function setShouldSucceed(bool _ok) external {
        shouldSucceed = _ok;
    }

    function setBurnConfig(address _tokenMessenger, address _usdc) external {
        tokenMessenger = _tokenMessenger;
        usdcToMint = _usdc;
    }

    function sendMessage(
        uint32, // destinationDomain
        bytes32, // recipient
        bytes32, // destinationCaller
        uint32, // minFinalityThreshold
        bytes memory messageBody
    ) external override {
        lastSentMessage = messageBody;
    }

    function receiveMessage(
        bytes calldata message,
        bytes calldata /* attestation */
    ) external override returns (bool) {
        if (!shouldSucceed) {
            return false;
        }

        uint32 sourceDomain = message.extractUint32(SOURCE_DOMAIN_INDEX);
        address sender = message.extractAddress(SENDER_INDEX);
        address recipient = message.extractAddress(RECIPIENT_INDEX);
        bytes memory body = message.extractSlice(
            MESSAGE_BODY_INDEX,
            message.length
        );

        // Burn-message path: mint USDC to the burn body's mintRecipient. NO hook callback —
        // the destination CCTPAdapter is expected to parse the burn body itself.
        if (sender == tokenMessenger && tokenMessenger != address(0)) {
            address mintRecipient = body.extractAddress(
                BURN_BODY_MINT_RECIPIENT_INDEX
            );
            uint256 amount = body.extractUint256(BURN_BODY_AMOUNT_INDEX);
            uint256 feeExecuted = body.extractUint256(
                BURN_BODY_FEE_EXECUTED_INDEX
            );
            require(amount >= feeExecuted, "Mock: bad fee");
            uint256 minted = amount - feeExecuted;
            if (minted > 0) {
                IMintableUSDC(usdcToMint).mintTo(mintRecipient, minted);
            }
            emit BurnMessageMinted(mintRecipient, amount, feeExecuted);
            return true;
        }

        // Pure-message path: call the recipient's IMessageHandlerV2 hook with the body.
        IMessageHandlerV2(recipient).handleReceiveFinalizedMessage(
            sourceDomain,
            bytes32(uint256(uint160(sender))),
            2000,
            body
        );
        emit MessageForwarded(recipient, sourceDomain, sender);
        return true;
    }
}
