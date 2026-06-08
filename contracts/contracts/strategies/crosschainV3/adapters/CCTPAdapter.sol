// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICCTPTokenMessenger, ICCTPMessageTransmitter, IMessageHandlerV2 } from "../../../interfaces/cctp/ICCTP.sol";
import { AbstractAdapter } from "./AbstractAdapter.sol";
import { CCTPMessageHelper } from "../libraries/CCTPMessageHelper.sol";

/**
 * @title CCTPAdapter
 * @author Origin Protocol Inc
 *
 * @notice Atomic bidirectional adapter over Circle CCTP V2.
 *           - Outbound (`sendMessageAndTokens`): burn USDC via `depositForBurnWithHook` with
 *             the wrapped envelope as the hook data. The recipient mint amount equals the
 *             burn amount minus CCTP's protocol fee (0 for finalised threshold, > 0 for
 *             fast finality). The fee is absorbed by the protocol; the receiving strategy
 *             accounts on the actual landed amount.
 *           - Outbound (`sendMessage`): post a hook-only message via the MessageTransmitter.
 *           - Inbound (`handleReceiveFinalizedMessage`): CCTP MessageTransmitter has minted
 *             USDC to this adapter. Validate source domain + sender against the lane config,
 *             then forward the actual minted amount to the destination strategy.
 *
 *         CCTP has no native bridge fee — `_quoteFee` returns 0 and the AbstractAdapter's
 *         `msg.value` plumbing simply refunds whatever the caller forwarded.
 */
contract CCTPAdapter is AbstractAdapter, IMessageHandlerV2 {
    using SafeERC20 for IERC20;

    /// @notice CCTP V2 protocol cap per burn. Hard-coded as a `constant` so it can't be
    ///         raised by governance — Circle decides this number, not us. Higher values
    ///         would revert at the TokenMessenger anyway; we reject early for a cleaner
    ///         error message. If Circle ever raises the cap, this constant gets bumped via
    ///         contract upgrade, not via governance setter.
    uint256 public constant MAX_TRANSFER_AMOUNT = 10_000_000 * 10**6; // 10M USDC

    /// @notice USDC on this chain.
    address public immutable usdcToken;
    /// @notice Circle CCTP V2 Token Messenger.
    ICCTPTokenMessenger public immutable tokenMessenger;
    /// @notice Circle CCTP V2 Message Transmitter (message-only sends + inbound delivery).
    ICCTPMessageTransmitter public immutable messageTransmitter;

    /// @notice Minimum finality threshold sent on every transfer. Range: 1000–2000.
    ///         2000 = finalised (zero protocol fee, ~13 minute delay on Ethereum).
    ///         1000–1999 = fast finality (non-zero token-side fee, sub-minute delivery).
    ///
    ///         NOT initialised at declaration — that would only set the storage slot on
    ///         the implementation, not on the proxy. Governor must call
    ///         `setMinFinalityThreshold` post-deploy. Send-side guard catches the
    ///         pre-init mistake with a clear revert message.
    uint32 public minFinalityThreshold;

    /// @notice Lower bound on USDC transfers; governor-settable. Avoids dust burns that
    ///         waste gas + CCTP attestation latency on negligible amounts.
    uint256 public minTransferAmount;

    /// @notice Account allowed to invoke `relay(message, attestation)` — the off-chain
    ///         attestation poller / relayer. Single address; governor-settable. CCTP is
    ///         pull-driven so this role is required at the adapter level; CCIP and
    ///         Superbridge don't need it.
    address public operator;

    event MinFinalityThresholdUpdated(uint32 oldThreshold, uint32 newThreshold);
    event MinTransferAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event OperatorUpdated(address oldOperator, address newOperator);
    event MessageRelayed(address indexed by, uint32 sourceDomain);

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

    modifier onlyOperator() {
        require(msg.sender == operator, "CCTP: not operator");
        _;
    }

    function setMinFinalityThreshold(uint32 _t) external onlyGovernor {
        require(_t >= 1000 && _t <= 2000, "CCTP: bad threshold");
        emit MinFinalityThresholdUpdated(minFinalityThreshold, _t);
        minFinalityThreshold = _t;
    }

    function setMinTransferAmount(uint256 _amount) external onlyGovernor {
        emit MinTransferAmountUpdated(minTransferAmount, _amount);
        minTransferAmount = _amount;
    }

    function setOperator(address _operator) external onlyGovernor {
        emit OperatorUpdated(operator, _operator);
        operator = _operator;
    }

    // --- Relay (operator-driven inbound finalisation) ---------------------

    /**
     * @notice Operator entry point: hand a Circle-signed CCTP message + attestation pair
     *         to the local MessageTransmitter, then dispatch the payload to the destination
     *         strategy.
     *
     *         CCTP V2 has two on-wire message shapes that both arrive here:
     *
     *         1. **Burn-message + hook** (sourced from `TokenMessenger.depositForBurnWithHook`).
     *            The transport `sender` is the source-side `TokenMessenger`. The transport
     *            `recipient` is the destination `TokenMessenger`, NOT this adapter. The
     *            body is a CCTP burn body containing burnToken / mintRecipient / amount /
     *            msgSender / feeExecuted / hookData. Auto-dispatch via
     *            `handleReceiveMessage` on the mintRecipient is V2.1-only and not
     *            universally available across Circle's chain deployments, so we DON'T rely
     *            on it. Instead: we call `messageTransmitter.receiveMessage` (which credits
     *            USDC to this adapter as the configured mintRecipient), then parse the burn
     *            body ourselves and call `_deliver` with the authoritative `amount -
     *            feeExecuted` and the hookData (our application envelope). This mirrors
     *            the older `AbstractCCTPIntegrator.relay()` pattern, which has been
     *            exercised in production.
     *
     *         2. **Pure message** (sourced from `MessageTransmitter.sendMessage`). Transport
     *            `sender` and `recipient` are both this adapter (CREATE3 parity). The body
     *            is our application envelope directly. `messageTransmitter.receiveMessage`
     *            triggers our own `handleReceiveFinalizedMessage` hook, which calls
     *            `_handleInbound` and dispatches.
     */
    function relay(bytes calldata message, bytes calldata attestation)
        external
        onlyOperator
    {
        (
            uint32 version,
            uint32 sourceDomain,
            address transportSender,
            address transportRecipient,
            bytes memory body
        ) = CCTPMessageHelper.decodeMessageHeader(message);
        require(
            version == CCTPMessageHelper.CCTP_V2_VERSION,
            "CCTP: bad msg version"
        );

        // Burn messages have the source TokenMessenger as their transport sender. Pure
        // messages have this adapter as both transport sender and recipient (CREATE3
        // parity).
        if (transportSender == address(tokenMessenger)) {
            _relayBurn(sourceDomain, body, message, attestation);
        } else {
            require(transportRecipient == address(this), "CCTP: not for us");
            require(
                messageTransmitter.receiveMessage(message, attestation),
                "CCTP: relay failed"
            );
            // MessageTransmitter has now invoked our `handleReceiveFinalizedMessage` (or
            // unfinalized variant). Nothing more to do here.
        }
        emit MessageRelayed(msg.sender, sourceDomain);
    }

    /// @dev Burn-message path. Parse the burn body for authoritative amount/fee/hookData,
    ///      then `receiveMessage` to credit USDC, then validate + dispatch.
    function _relayBurn(
        uint32 sourceDomain,
        bytes memory body,
        bytes calldata message,
        bytes calldata attestation
    ) internal {
        (
            address burnToken,
            uint256 amount,
            address msgSender,
            uint256 feeExecuted,
            bytes memory hookData
        ) = CCTPMessageHelper.decodeBurnBody(body);
        require(burnToken == usdcToken, "CCTP: bad burn token");

        uint256 balanceBefore = IERC20(usdcToken).balanceOf(address(this));
        require(
            messageTransmitter.receiveMessage(message, attestation),
            "CCTP: relay failed"
        );
        uint256 landed = _landedAmount(
            IERC20(usdcToken).balanceOf(address(this)) - balanceBefore,
            amount - feeExecuted
        );
        _dispatchBurn(
            sourceDomain,
            msgSender,
            hookData,
            landed,
            feeExecuted,
            amount
        );
    }

    /// @dev Choose the authoritative landed amount: prefer the smaller of the actual
    ///      mint delta and the expected `amount - feeExecuted`. This isolates donations
    ///      (extra balance arriving between the snapshot and the mint stays on the
    ///      adapter) and also defends against short mints (deliver what we actually got).
    function _landedAmount(uint256 minted, uint256 expected)
        internal
        pure
        returns (uint256)
    {
        return minted < expected ? minted : expected;
    }

    function _dispatchBurn(
        uint32 sourceDomain,
        address msgSender,
        bytes memory hookData,
        uint256 landed,
        uint256 feeExecuted,
        uint256 burnAmount
    ) internal {
        (
            address envelopeSender,
            uint256 intendedAmount,
            bytes memory payload
        ) = _validateInbound(uint64(sourceDomain), msgSender, hookData);
        // Sanity: source-side intent equals the full burn `amount` (the application's
        // pre-fee intent). `intendedAmount == 0` is permitted for envelopes that don't
        // pre-set the amount.
        require(
            intendedAmount == 0 || intendedAmount == burnAmount,
            "CCTP: intent mismatch"
        );
        _deliver(envelopeSender, usdcToken, landed, feeExecuted, payload);
    }

    // --- Outbound hooks ----------------------------------------------------

    /// @dev CCTP V2 has NO native fee. The protocol fee (when fast finality is used) is
    ///      deducted by CCTP itself from the burned token amount — the caller doesn't need
    ///      to supply anything separately. We report this as `requiresExternalPayment =
    ///      false` so the strategy skips the msg.value check entirely.
    ///
    ///      For token-carrying sends we still report `fee = getMinFeeAmount(amount)` and
    ///      `feeToken = usdcToken` for telemetry/observability; this is the upper bound
    ///      the protocol could take. For message-only sends, no token, no fee.
    function _quoteFee(
        bytes memory, // envelope
        ChainConfig memory, // cfg
        address token,
        uint256 amount
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
        if (token == address(0) || amount == 0) {
            return (0, address(0), false);
        }
        fee = tokenMessenger.getMinFeeAmount(amount);
        feeToken = usdcToken;
        requiresExternalPayment = false;
    }

    function _sendMessage(
        bytes memory envelope,
        ChainConfig memory cfg,
        uint256 /* fee */
    ) internal override {
        // Hook-only message via the transmitter (no token leg). destinationCaller is the
        // peer adapter address (CREATE3 parity) so only it can finalise on the destination.
        require(minFinalityThreshold > 0, "CCTP: threshold not set");
        messageTransmitter.sendMessage(
            uint32(cfg.chainSelector),
            _addressToBytes32(address(this)),
            _addressToBytes32(address(this)),
            minFinalityThreshold,
            envelope
        );
    }

    function _sendMessageAndTokens(
        address token,
        uint256 amount,
        bytes memory envelope,
        ChainConfig memory cfg,
        uint256 /* fee */
    ) internal override {
        require(token == usdcToken, "CCTP: token must be usdc");
        require(minFinalityThreshold > 0, "CCTP: threshold not set");
        // Bounds: dust floor (governor-set) + Circle's hard per-burn cap. AbstractAdapter
        // already enforces `maxTransferAmount` if set; we ALSO enforce the protocol-level
        // constant so an under-configured maxTransferAmount can't accidentally allow a
        // larger burn than CCTP itself accepts.
        require(amount >= minTransferAmount, "CCTP: amount below min");
        require(amount <= MAX_TRANSFER_AMOUNT, "CCTP: amount above CCTP cap");

        // CCTP V2 will deduct an actual fee (<= maxFee) from the burn; recipient mints the
        // remainder. We pass maxFee as the upper bound the protocol authorises; with the
        // default `minFinalityThreshold = 2000` (finalised) the protocol fee is 0.
        uint256 maxFee = tokenMessenger.getMinFeeAmount(amount);
        IERC20(token).safeApprove(address(tokenMessenger), amount);
        tokenMessenger.depositForBurnWithHook(
            amount,
            uint32(cfg.chainSelector),
            _addressToBytes32(address(this)), // mintRecipient = peer adapter
            token,
            _addressToBytes32(address(this)), // destinationCaller = peer adapter
            maxFee,
            minFinalityThreshold,
            envelope
        );
    }

    function _addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    function _bytes32ToAddress(bytes32 _b) internal pure returns (address) {
        return address(uint160(uint256(_b)));
    }

    // --- Inbound (IMessageHandlerV2) ---------------------------------------

    /// @inheritdoc IMessageHandlerV2
    function handleReceiveFinalizedMessage(
        uint32 sourceDomain,
        bytes32 sender,
        uint32, // finalityThresholdExecuted
        bytes calldata messageBody
    ) external override onlyCCTP returns (bool) {
        _handleInbound(sourceDomain, sender, messageBody);
        return true;
    }

    /// @inheritdoc IMessageHandlerV2
    /// @dev Accepts pre-finalised inbound when CCTP has executed at least the configured
    ///      `minFinalityThreshold`. This is how fast-finality (1000 <= threshold < 2000)
    ///      actually delivers — MessageTransmitter routes via this handler when
    ///      `finalityThresholdExecuted < 2000`, and we accept if it's >= our floor.
    ///
    ///      If `minFinalityThreshold == 2000` (default for finalised-only deployments),
    ///      this rejects every unfinalised callback — the strict-finalised mode.
    ///
    ///      If `minFinalityThreshold == 0` (governor hasn't called the setter yet), we
    ///      reject everything, defensive against pre-init relays.
    function handleReceiveUnfinalizedMessage(
        uint32 sourceDomain,
        bytes32 sender,
        uint32 finalityThresholdExecuted,
        bytes calldata messageBody
    ) external override onlyCCTP returns (bool) {
        require(minFinalityThreshold > 0, "CCTP: threshold not set");
        require(
            finalityThresholdExecuted >= minFinalityThreshold,
            "CCTP: insufficient finality"
        );
        _handleInbound(sourceDomain, sender, messageBody);
        return true;
    }

    /// @dev Pure-message-only inbound hook. The MessageTransmitter calls this on us
    ///      directly only for message-only sends (no token leg). Burn messages flow
    ///      through `relay()`'s manual parsing path instead — we don't take the chance
    ///      that CCTP's auto-callback fires only on V2.1 chains.
    ///
    ///      `messageBody` here IS our application envelope (because `sendMessage`
    ///      forwards it verbatim to the recipient hook). `intendedAmount` should be 0
    ///      since this is the no-token path; reject otherwise to surface design drift
    ///      early.
    function _handleInbound(
        uint32 sourceDomain,
        bytes32 sender,
        bytes calldata messageBody
    ) internal {
        (
            address envelopeSender,
            uint256 intendedAmount,
            bytes memory payload
        ) = _validateInbound(
                uint64(sourceDomain),
                _bytes32ToAddress(sender),
                messageBody
            );
        require(intendedAmount == 0, "CCTP: token leg via pure-message path");
        _deliver(envelopeSender, address(0), 0, 0, payload);
    }
}
