// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title AbstractCCTPIntegrator
 * @author Origin Protocol Inc
 *
 * @dev Abstract contract that contains all the logic used to integrate with CCTP.
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";

import { ICCTPTokenMessenger, ICCTPMessageTransmitter, IMessageHandlerV2 } from "../../interfaces/cctp/ICCTP.sol";

import { CrossChainStrategyHelper } from "./CrossChainStrategyHelper.sol";
import { Governable } from "../../governance/Governable.sol";
import { BytesHelper } from "../../utils/BytesHelper.sol";
import "../../utils/Helpers.sol";

abstract contract AbstractCCTPIntegrator is Governable, IMessageHandlerV2 {
    using SafeERC20 for IERC20;

    using BytesHelper for bytes;
    using CrossChainStrategyHelper for bytes;

    event CCTPMinFinalityThresholdSet(uint16 minFinalityThreshold);
    event CCTPFeePremiumBpsSet(uint16 feePremiumBps);
    event OperatorChanged(address operator);
    event TokensBridged(
        uint32 destinationDomain,
        address peerStrategy,
        address tokenAddress,
        uint256 tokenAmount,
        uint256 maxFee,
        uint32 minFinalityThreshold,
        bytes hookData
    );
    event MessageTransmitted(
        uint32 destinationDomain,
        address peerStrategy,
        uint32 minFinalityThreshold,
        bytes message
    );

    // Message body V2 fields
    // Ref: https://developers.circle.com/cctp/technical-guide#message-body
    // Ref: https://github.com/circlefin/evm-cctp-contracts/blob/master/src/messages/v2/BurnMessageV2.sol
    uint8 private constant BURN_MESSAGE_V2_VERSION_INDEX = 0;
    uint8 private constant BURN_MESSAGE_V2_RECIPIENT_INDEX = 36;
    uint8 private constant BURN_MESSAGE_V2_AMOUNT_INDEX = 68;
    uint8 private constant BURN_MESSAGE_V2_MESSAGE_SENDER_INDEX = 100;
    uint8 private constant BURN_MESSAGE_V2_FEE_EXECUTED_INDEX = 164;
    uint8 private constant BURN_MESSAGE_V2_HOOK_DATA_INDEX = 228;

    /**
     * @notice Max transfer threshold imposed by the CCTP
     *         Ref: https://developers.circle.com/cctp/evm-smart-contracts#depositforburn
     */
    uint256 public constant MAX_TRANSFER_AMOUNT = 10_000_000 * 10**6; // 10M USDC

    // CCTP contracts
    // This implementation assumes that remote and local chains have these contracts
    // deployed on the same addresses.
    /// @notice CCTP message transmitter contract
    ICCTPMessageTransmitter public immutable cctpMessageTransmitter;
    /// @notice CCTP token messenger contract
    ICCTPTokenMessenger public immutable cctpTokenMessenger;

    /// @notice USDC address on local chain
    address public immutable usdcToken;

    /// @notice Domain ID of the chain from which messages are accepted
    uint32 public immutable peerDomainID;

    /// @notice Strategy address on other chain
    address public immutable peerStrategy;

    /**
     * @notice Minimum finality threshold
     *         Can be 1000 (safe, after 1 epoch) or 2000 (finalized, after 2 epochs).
     *         Ref: https://developers.circle.com/cctp/technical-guide#finality-thresholds
     */
    uint16 public minFinalityThreshold;

    /// @notice Fee premium in basis points
    uint16 public feePremiumBps;

    /// @notice Nonce of the last known deposit or withdrawal
    uint64 public lastTransferNonce;

    /// @notice Operator address: Can relay CCTP messages
    address public operator;

    /// @notice Mapping of processed nonces
    mapping(uint64 => bool) private nonceProcessed;

    // For future use
    uint256[48] private __gap;

    modifier onlyCCTPMessageTransmitter() {
        require(
            msg.sender == address(cctpMessageTransmitter),
            "Caller is not CCTP transmitter"
        );
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "Caller is not the Operator");
        _;
    }

    /**
     * @notice Configuration for CCTP integration
     * @param cctpTokenMessenger Address of the CCTP token messenger contract
     * @param cctpMessageTransmitter Address of the CCTP message transmitter contract
     * @param peerDomainID Domain ID of the chain from which messages are accepted.
     *         0 for Ethereum, 6 for Base, etc.
     *         Ref: https://developers.circle.com/cctp/cctp-supported-blockchains
     * @param peerStrategy Address of the master or remote strategy on the other chain
     * @param usdcToken USDC address on local chain
     */
    struct CCTPIntegrationConfig {
        address cctpTokenMessenger;
        address cctpMessageTransmitter;
        uint32 peerDomainID;
        address peerStrategy;
        address usdcToken;
    }

    constructor(CCTPIntegrationConfig memory _config) {
        require(_config.usdcToken != address(0), "Invalid USDC address");
        require(
            _config.cctpTokenMessenger != address(0),
            "Invalid CCTP config"
        );
        require(
            _config.cctpMessageTransmitter != address(0),
            "Invalid CCTP config"
        );
        require(
            _config.peerStrategy != address(0),
            "Invalid peer strategy address"
        );

        cctpMessageTransmitter = ICCTPMessageTransmitter(
            _config.cctpMessageTransmitter
        );
        cctpTokenMessenger = ICCTPTokenMessenger(_config.cctpTokenMessenger);

        // Domain ID of the chain from which messages are accepted
        peerDomainID = _config.peerDomainID;

        // Strategy address on other chain, should
        // always be same as the proxy of this strategy
        peerStrategy = _config.peerStrategy;

        // USDC address on local chain
        usdcToken = _config.usdcToken;

        // Just a sanity check to ensure the base token is USDC
        uint256 _usdcTokenDecimals = Helpers.getDecimals(_config.usdcToken);
        string memory _usdcTokenSymbol = Helpers.getSymbol(_config.usdcToken);
        require(_usdcTokenDecimals == 6, "Base token decimals must be 6");
        require(
            keccak256(abi.encodePacked(_usdcTokenSymbol)) ==
                keccak256(abi.encodePacked("USDC")),
            "Token symbol must be USDC"
        );
    }

    /**
     * @dev Initialize the implementation contract
     * @param _operator Operator address
     * @param _minFinalityThreshold Minimum finality threshold
     * @param _feePremiumBps Fee premium in basis points
     */
    function _initialize(
        address _operator,
        uint16 _minFinalityThreshold,
        uint16 _feePremiumBps
    ) internal {
        _setOperator(_operator);
        _setMinFinalityThreshold(_minFinalityThreshold);
        _setFeePremiumBps(_feePremiumBps);
    }

    /***************************************
                    Settings
    ****************************************/
    /**
     * @dev Set the operator address
     * @param _operator Operator address
     */
    function setOperator(address _operator) external onlyGovernor {
        _setOperator(_operator);
    }

    /**
     * @dev Set the operator address
     * @param _operator Operator address
     */
    function _setOperator(address _operator) internal {
        operator = _operator;
        emit OperatorChanged(_operator);
    }

    /**
     * @dev Set the minimum finality threshold at which
     *      the message is considered to be finalized to relay.
     *      Only accepts a value of 1000 (Safe, after 1 epoch) or
     *      2000 (Finalized, after 2 epochs).
     * @param _minFinalityThreshold Minimum finality threshold
     */
    function setMinFinalityThreshold(uint16 _minFinalityThreshold)
        external
        onlyGovernor
    {
        _setMinFinalityThreshold(_minFinalityThreshold);
    }

    /**
     * @dev Set the minimum finality threshold
     * @param _minFinalityThreshold Minimum finality threshold
     */
    function _setMinFinalityThreshold(uint16 _minFinalityThreshold) internal {
        // 1000 for fast transfer and 2000 for standard transfer
        require(
            _minFinalityThreshold == 1000 || _minFinalityThreshold == 2000,
            "Invalid threshold"
        );

        minFinalityThreshold = _minFinalityThreshold;
        emit CCTPMinFinalityThresholdSet(_minFinalityThreshold);
    }

    /**
     * @dev Set the fee premium in basis points.
     *      Cannot be higher than 30% (3000 basis points).
     * @param _feePremiumBps Fee premium in basis points
     */
    function setFeePremiumBps(uint16 _feePremiumBps) external onlyGovernor {
        _setFeePremiumBps(_feePremiumBps);
    }

    /**
     * @dev Set the fee premium in basis points
     *      Cannot be higher than 30% (3000 basis points).
     *      Ref: https://developers.circle.com/cctp/technical-guide#fees
     * @param _feePremiumBps Fee premium in basis points
     */
    function _setFeePremiumBps(uint16 _feePremiumBps) internal {
        require(_feePremiumBps <= 3000, "Fee premium too high"); // 30%

        feePremiumBps = _feePremiumBps;
        emit CCTPFeePremiumBpsSet(_feePremiumBps);
    }

    /***************************************
             CCTP message handling
    ****************************************/

    /**
     * @dev Handles a finalized CCTP message
     * @param sourceDomain Source domain of the message
     * @param sender Sender of the message
     * @param finalityThresholdExecuted Fidelity threshold executed
     * @param messageBody Message body
     */
    function handleReceiveFinalizedMessage(
        uint32 sourceDomain,
        bytes32 sender,
        uint32 finalityThresholdExecuted,
        bytes memory messageBody
    ) external override onlyCCTPMessageTransmitter returns (bool) {
        return
            _handleReceivedMessage(
                sourceDomain,
                sender,
                finalityThresholdExecuted,
                messageBody
            );
    }

    /**
     * @dev Handles an unfinalized but safe CCTP message
     * @param sourceDomain Source domain of the message
     * @param sender Sender of the message
     * @param finalityThresholdExecuted Fidelity threshold executed
     * @param messageBody Message body
     */
    function handleReceiveUnfinalizedMessage(
        uint32 sourceDomain,
        bytes32 sender,
        uint32 finalityThresholdExecuted,
        bytes memory messageBody
    ) external override onlyCCTPMessageTransmitter returns (bool) {
        // Make sure the contract is configured to handle unfinalized messages
        require(
            minFinalityThreshold == 1000,
            "Unfinalized messages are not supported"
        );

        return
            _handleReceivedMessage(
                sourceDomain,
                sender,
                finalityThresholdExecuted,
                messageBody
            );
    }

    /**
     * @dev Handles a CCTP message
     * @param sourceDomain Source domain of the message
     * @param sender Sender of the message
     * @param finalityThresholdExecuted Fidelity threshold executed
     * @param messageBody Message body
     */
    function _handleReceivedMessage(
        uint32 sourceDomain,
        bytes32 sender,
        // solhint-disable-next-line no-unused-vars
        uint32 finalityThresholdExecuted,
        bytes memory messageBody
    ) internal returns (bool) {
        require(sourceDomain == peerDomainID, "Unknown Source Domain");

        // Extract address from bytes32 (CCTP stores addresses as right-padded bytes32)
        address senderAddress = address(uint160(uint256(sender)));
        require(senderAddress == peerStrategy, "Unknown Sender");

        _onMessageReceived(messageBody);

        return true;
    }

    /**
     * @dev Sends tokens to the peer strategy using CCTP Token Messenger
     * @param tokenAmount Amount of tokens to send
     * @param hookData Hook data
     */
    function _sendTokens(uint256 tokenAmount, bytes memory hookData)
        internal
        virtual
    {
        // CCTP has a maximum transfer amount of 10M USDC per tx
        require(tokenAmount <= MAX_TRANSFER_AMOUNT, "Token amount too high");

        // Approve only what needs to be transferred
        IERC20(usdcToken).safeApprove(address(cctpTokenMessenger), tokenAmount);

        // Compute the max fee to be paid.
        // Ref: https://developers.circle.com/cctp/evm-smart-contracts#getminfeeamount
        // The right way to compute fees would be to use CCTP's getMinFeeAmount function.
        // The issue is that the getMinFeeAmount is not present on v2.0 contracts, but is on
        // v2.1. Some of CCTP's deployed contracts are v2.0, some are v2.1.
        // We will only be using standard transfers and fee on those is 0 for now. If they
        // ever start implementing fee for standard transfers or if we decide to use fast
        // trasnfer, we can use feePremiumBps as a workaround.
        uint256 maxFee = feePremiumBps > 0
            ? (tokenAmount * feePremiumBps) / 10000
            : 0;

        // Send tokens to the peer strategy using CCTP Token Messenger
        cctpTokenMessenger.depositForBurnWithHook(
            tokenAmount,
            peerDomainID,
            bytes32(uint256(uint160(peerStrategy))),
            address(usdcToken),
            bytes32(uint256(uint160(peerStrategy))),
            maxFee,
            uint32(minFinalityThreshold),
            hookData
        );

        emit TokensBridged(
            peerDomainID,
            peerStrategy,
            usdcToken,
            tokenAmount,
            maxFee,
            uint32(minFinalityThreshold),
            hookData
        );
    }

    /**
     * @dev Sends a message to the peer strategy using CCTP Message Transmitter
     * @param message Payload of the message to send
     */
    function _sendMessage(bytes memory message) internal virtual {
        cctpMessageTransmitter.sendMessage(
            peerDomainID,
            bytes32(uint256(uint160(peerStrategy))),
            bytes32(uint256(uint160(peerStrategy))),
            uint32(minFinalityThreshold),
            message
        );

        emit MessageTransmitted(
            peerDomainID,
            peerStrategy,
            uint32(minFinalityThreshold),
            message
        );
    }

    /**
     * @dev Receives a message from the peer strategy on the other chain,
     *      does some basic checks and relays it to the local MessageTransmitterV2.
     *      If the message is a burn message, it will also handle the hook data
     *      and call the _onTokenReceived function.
     * @param message Payload of the message to send
     * @param attestation Attestation of the message
     */
    function relay(bytes memory message, bytes memory attestation)
        external
        onlyOperator
    {
        (
            uint32 version,
            uint32 sourceDomainID,
            address sender,
            address recipient,
            bytes memory messageBody
        ) = message.decodeMessageHeader();

        // Ensure that it's a CCTP message
        require(
            version == CrossChainStrategyHelper.CCTP_MESSAGE_VERSION,
            "Invalid CCTP message version"
        );

        // Ensure that the source domain is the peer domain
        require(sourceDomainID == peerDomainID, "Unknown Source Domain");

        // Ensure message body version
        version = messageBody.extractUint32(BURN_MESSAGE_V2_VERSION_INDEX);

        // NOTE: There's a possibility that the CCTP Token Messenger might
        // send other types of messages in future, not just the burn message.
        // If it ever comes to that, this shouldn't cause us any problems
        // because it has to still go through the followign checks:
        // - version check
        // - message body length check
        // - sender and recipient (which should be in the same slots and same as address(this))
        // - hook data handling (which will revert even if all the above checks pass)
        bool isBurnMessageV1 = sender == address(cctpTokenMessenger);

        if (isBurnMessageV1) {
            // Handle burn message
            require(
                version == 1 &&
                    messageBody.length >= BURN_MESSAGE_V2_HOOK_DATA_INDEX,
                "Invalid burn message"
            );

            // Address of caller of depositForBurn (or depositForBurnWithCaller) on source domain
            sender = messageBody.extractAddress(
                BURN_MESSAGE_V2_MESSAGE_SENDER_INDEX
            );

            recipient = messageBody.extractAddress(
                BURN_MESSAGE_V2_RECIPIENT_INDEX
            );
        } else {
            // We handle only Burn message or our custom messagee
            require(
                version == CrossChainStrategyHelper.ORIGIN_MESSAGE_VERSION,
                "Unsupported message version"
            );
        }

        // Ensure the recipient is this contract
        // Both sender and recipient should be deployed to same address on both chains.
        require(address(this) == recipient, "Unexpected recipient address");
        require(sender == peerStrategy, "Incorrect sender/recipient address");

        // Relay the message
        // This step also mints USDC and transfers it to the recipient wallet
        bool relaySuccess = cctpMessageTransmitter.receiveMessage(
            message,
            attestation
        );
        require(relaySuccess, "Receive message failed");

        if (isBurnMessageV1) {
            // Extract the hook data from the message body
            bytes memory hookData = messageBody.extractSlice(
                BURN_MESSAGE_V2_HOOK_DATA_INDEX,
                messageBody.length
            );

            // Extract the token amount from the message body
            uint256 tokenAmount = messageBody.extractUint256(
                BURN_MESSAGE_V2_AMOUNT_INDEX
            );

            // Extract the fee executed from the message body
            uint256 feeExecuted = messageBody.extractUint256(
                BURN_MESSAGE_V2_FEE_EXECUTED_INDEX
            );

            // Call the _onTokenReceived function
            _onTokenReceived(tokenAmount - feeExecuted, feeExecuted, hookData);
        }
    }

    /***************************************
                  Message utils
    ****************************************/

    /***************************************
                  Nonce Handling
    ****************************************/
    /**
     * @dev Checks if the last known transfer is pending.
     *      Nonce starts at 1, so 0 is disregarded.
     * @return True if a transfer is pending, false otherwise
     */
    function isTransferPending() public view returns (bool) {
        uint64 nonce = lastTransferNonce;
        return nonce > 0 && !nonceProcessed[nonce];
    }

    /**
     * @dev Checks if a given nonce is processed.
     *      Nonce starts at 1, so 0 is disregarded.
     * @param nonce Nonce to check
     * @return True if the nonce is processed, false otherwise
     */
    function isNonceProcessed(uint64 nonce) public view returns (bool) {
        return nonce == 0 || nonceProcessed[nonce];
    }

    /**
     * @dev Marks a given nonce as processed.
     *      Can only mark nonce as processed once. New nonce should
     *      always be greater than the last known nonce. Also updates
     *      the last known nonce.
     * @param nonce Nonce to mark as processed
     */
    function _markNonceAsProcessed(uint64 nonce) internal {
        uint64 lastNonce = lastTransferNonce;

        // Can only mark latest nonce as processed
        // Master strategy when receiving a message from the remote strategy
        // will have lastNone == nonce, as the nonce is increase at the start
        // of deposit / withdrawal flow.
        // Remote strategy will have lastNonce < nonce, as a new nonce initiated
        // from master will be greater than the last one.
        require(nonce >= lastNonce, "Nonce too low");
        // Can only mark nonce as processed once
        require(!nonceProcessed[nonce], "Nonce already processed");

        nonceProcessed[nonce] = true;

        if (nonce != lastNonce) {
            // Update last known nonce
            lastTransferNonce = nonce;
        }
    }

    /**
     * @dev Gets the next nonce to use.
     *      Nonce starts at 1, so 0 is disregarded.
     *      Reverts if last nonce hasn't been processed yet.
     * @return Next nonce
     */
    function _getNextNonce() internal returns (uint64) {
        uint64 nonce = lastTransferNonce;

        require(
            nonce == 0 || nonceProcessed[nonce],
            "Pending deposit or withdrawal"
        );

        nonce = nonce + 1;
        lastTransferNonce = nonce;

        return nonce;
    }

    /***************************************
             Inheritence overrides
    ****************************************/

    /**
     * @dev Called when the USDC is received from the CCTP
     * @param tokenAmount The actual amount of USDC received (amount sent - fee executed)
     * @param feeExecuted The fee executed
     * @param payload The payload of the message (hook data)
     */
    function _onTokenReceived(
        uint256 tokenAmount,
        uint256 feeExecuted,
        bytes memory payload
    ) internal virtual;

    /**
     * @dev Called when the message is received
     * @param payload The payload of the message
     */
    function _onMessageReceived(bytes memory payload) internal virtual;
}
