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
     *         off to the local MessageTransmitter. CCTP V2 then verifies the attestation,
     *         mints USDC to this adapter (for burn messages), and calls back into
     *         `handleReceiveFinalizedMessage` where `_validateInbound` runs the per-lane
     *         security checks before `_deliver` forwards to the destination strategy.
     *
     *         This wrapper exists because we set `destinationCaller = address(this)` on
     *         the source-side burn, so the destination MessageTransmitter only accepts
     *         the finalisation call from this adapter — an off-chain relayer can't call
     *         MessageTransmitter directly.
     *
     *         Cheap pre-validation here (CCTP-message version + recipient match) fails
     *         the tx early when the attestation is good but the message wasn't meant for
     *         us. Deeper checks (source domain, envelope sender, peer-adapter parity,
     *         lane pause) happen inside `_validateInbound` on the callback path.
     */
    function relay(bytes calldata message, bytes calldata attestation)
        external
        onlyOperator
    {
        (
            uint32 version,
            uint32 sourceDomain,
            ,
            address recipient,

        ) = CCTPMessageHelper.decodeMessageHeader(message);
        require(
            version == CCTPMessageHelper.CCTP_V2_VERSION,
            "CCTP: bad msg version"
        );
        require(recipient == address(this), "CCTP: not for us");
        require(
            messageTransmitter.receiveMessage(message, attestation),
            "CCTP: relay failed"
        );
        emit MessageRelayed(msg.sender, sourceDomain);
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

    function _handleInbound(
        uint32 sourceDomain,
        bytes32 sender,
        bytes calldata messageBody
    ) internal {
        // CCTP-side balance after the mint is the actual landed amount. The transmitter
        // mints USDC to this adapter atomically before invoking the handler.
        uint256 amountReceived = IERC20(usdcToken).balanceOf(address(this));

        (
            address envelopeSender,
            uint256 intendedAmount,
            bytes memory payload
        ) = _validateInbound(
                uint64(sourceDomain),
                _bytes32ToAddress(sender),
                messageBody
            );

        // CCTP's token-side fee is the difference between intent and landed amount.
        // intendedAmount is 0 for message-only sends; in that case feePaid is 0.
        uint256 feePaid = intendedAmount > amountReceived
            ? intendedAmount - amountReceived
            : 0;
        _deliver(envelopeSender, usdcToken, amountReceived, feePaid, payload);
    }
}
