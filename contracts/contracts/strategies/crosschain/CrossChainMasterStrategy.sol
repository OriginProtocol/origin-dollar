// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OUSD Yearn V3 Master Strategy - the Mainnet part
 * @author Origin Protocol Inc
 *
 * @dev This strategy can only perform 1 deposit or withdrawal at a time. For that
 *      reason it shouldn't be configured as an asset default strategy.
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { AbstractCCTPIntegrator } from "./AbstractCCTPIntegrator.sol";
import { CrossChainStrategyHelper } from "./CrossChainStrategyHelper.sol";

contract CrossChainMasterStrategy is
    AbstractCCTPIntegrator,
    InitializableAbstractStrategy
{
    using SafeERC20 for IERC20;
    using CrossChainStrategyHelper for bytes;

    /// @notice Remote strategy balance
    uint256 public remoteStrategyBalance;

    /// @notice Amount that's bridged but not yet received on the destination chain
    uint256 public pendingAmount;

    enum TransferType {
        None, // To avoid using 0
        Deposit,
        Withdrawal
    }
    /// @notice Mapping of nonce to transfer type
    mapping(uint64 => TransferType) public transferTypeByNonce;

    event RemoteStrategyBalanceUpdated(uint256 balance);
    event WithdrawRequested(address indexed asset, uint256 amount);

    /**
     * @param _stratConfig The platform and OToken vault addresses
     */
    constructor(
        BaseStrategyConfig memory _stratConfig,
        CCTPIntegrationConfig memory _cctpConfig
    )
        InitializableAbstractStrategy(_stratConfig)
        AbstractCCTPIntegrator(_cctpConfig)
    {}

    /**
     * @dev Initialize the strategy implementation
     * @param _operator Address of the operator
     * @param _minFinalityThreshold Minimum finality threshold
     * @param _feePremiumBps Fee premium in basis points
     */
    function initialize(
        address _operator,
        uint16 _minFinalityThreshold,
        uint16 _feePremiumBps
    ) external virtual onlyGovernor initializer {
        _initialize(_operator, _minFinalityThreshold, _feePremiumBps);

        address[] memory rewardTokens = new address[](0);
        address[] memory assets = new address[](0);
        address[] memory pTokens = new address[](0);

        InitializableAbstractStrategy._initialize(
            rewardTokens,
            assets,
            pTokens
        );
    }

    /// @inheritdoc InitializableAbstractStrategy
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    /// @inheritdoc InitializableAbstractStrategy
    function depositAll() external override onlyVault nonReentrant {
        uint256 balance = IERC20(baseToken).balanceOf(address(this));
        if (balance > 0) {
            _deposit(baseToken, balance);
        }
    }

    /// @inheritdoc InitializableAbstractStrategy
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_recipient == vaultAddress, "Only Vault can withdraw");

        _withdraw(_asset, _recipient, _amount);
    }

    /// @inheritdoc InitializableAbstractStrategy
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        // Withdraw everything in Remote strategy
        _withdraw(baseToken, vaultAddress, remoteStrategyBalance);
    }

    /// @inheritdoc InitializableAbstractStrategy
    function checkBalance(address _asset)
        public
        view
        override
        returns (uint256 balance)
    {
        require(_asset == baseToken, "Unsupported asset");

        // USDC balance on this contract
        // + USDC being bridged
        // + USDC cached in the corresponding Remote part of this contract
        return
            IERC20(baseToken).balanceOf(address(this)) +
            pendingAmount +
            remoteStrategyBalance;
    }

    /// @inheritdoc InitializableAbstractStrategy
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == baseToken;
    }

    /// @inheritdoc InitializableAbstractStrategy
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {}

    /// @inheritdoc InitializableAbstractStrategy
    function _abstractSetPToken(address, address) internal override {}

    /// @inheritdoc InitializableAbstractStrategy
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {}

    /// @inheritdoc AbstractCCTPIntegrator
    function _onMessageReceived(bytes memory payload) internal override {
        if (
            payload.getMessageType() ==
            CrossChainStrategyHelper.BALANCE_CHECK_MESSAGE
        ) {
            // Received when Remote strategy checks the balance
            _processBalanceCheckMessage(payload);
            return;
        }

        revert("Unknown message type");
    }

    /// @inheritdoc AbstractCCTPIntegrator
    function _onTokenReceived(
        uint256 tokenAmount,
        // solhint-disable-next-line no-unused-vars
        uint256 feeExecuted,
        bytes memory payload
    ) internal override {
        uint64 _nonce = lastTransferNonce;

        // Should be expecting an acknowledgement
        require(!isNonceProcessed(_nonce), "Nonce already processed");
        // Only a withdrawal can send tokens to Master strategy
        require(
            transferTypeByNonce[_nonce] == TransferType.Withdrawal,
            "Expecting withdrawal"
        );

        // Confirm receipt of tokens from Withdraw command
        _markNonceAsProcessed(_nonce);

        // Now relay to the regular flow
        // NOTE: Calling _onMessageReceived would mean that we are bypassing a
        // few checks that the regular flow does (like sourceDomainID check
        // and sender check in `handleReceiveFinalizedMessage`). However,
        // CCTPMessageRelayer relays the message first (which will go through
        // all the checks) and not update balance and then finally calls this
        // `_onTokenReceived` which will update the balance.
        // So, if any of the checks fail during the first no-balance-update flow,
        // this won't happen either, since the tx would revert.
        _onMessageReceived(payload);

        // Send any tokens in the contract to the Vault
        uint256 usdcBalance = IERC20(baseToken).balanceOf(address(this));
        // Should always have enough tokens
        require(usdcBalance >= tokenAmount, "Insufficient balance");
        // Transfer all tokens to the Vault to not leave any dust
        IERC20(baseToken).safeTransfer(vaultAddress, usdcBalance);

        // Emit withdrawal amount
        emit Withdrawal(baseToken, baseToken, usdcBalance);
    }

    /**
     * @dev Bridge and deposit asset into the remote strategy
     * @param _asset Address of the asset to deposit
     * @param depositAmount Amount of the asset to deposit
     */
    function _deposit(address _asset, uint256 depositAmount) internal virtual {
        require(_asset == baseToken, "Unsupported asset");
        require(pendingAmount == 0, "Unexpected pending amount");
        require(depositAmount > 0, "Deposit amount must be greater than 0");
        require(
            depositAmount <= MAX_TRANSFER_AMOUNT,
            "Deposit amount exceeds max transfer amount"
        );

        // Get the next nonce
        // Note: reverts if a transfer is pending
        uint64 nonce = _getNextNonce();
        transferTypeByNonce[nonce] = TransferType.Deposit;

        // Set pending amount
        pendingAmount = depositAmount;

        // Build deposit message payload
        bytes memory message = CrossChainStrategyHelper.encodeDepositMessage(
            nonce,
            depositAmount
        );

        // Send deposit message to the remote strategy
        _sendTokens(depositAmount, message);

        // Emit deposit event
        emit Deposit(_asset, _asset, depositAmount);
    }

    /**
     * @dev Send a withdraw request to the remote strategy
     * @param _asset Address of the asset to withdraw
     * @param _recipient Address to receive the withdrawn asset
     * @param _amount Amount of the asset to withdraw
     */
    function _withdraw(
        address _asset,
        address _recipient,
        uint256 _amount
    ) internal virtual {
        require(_asset == baseToken, "Unsupported asset");
        require(_amount > 0, "Withdraw amount must be greater than 0");
        require(_recipient == vaultAddress, "Only Vault can withdraw");
        require(
            _amount <= remoteStrategyBalance,
            "Withdraw amount exceeds remote strategy balance"
        );
        require(
            _amount <= MAX_TRANSFER_AMOUNT,
            "Withdraw amount exceeds max transfer amount"
        );

        // Get the next nonce
        // Note: reverts if a transfer is pending
        uint64 nonce = _getNextNonce();
        transferTypeByNonce[nonce] = TransferType.Withdrawal;

        // Build and send withdrawal message with payload
        bytes memory message = CrossChainStrategyHelper.encodeWithdrawMessage(
            nonce,
            _amount
        );
        _sendMessage(message);

        // Emit WithdrawRequested event here,
        // Withdraw will be emitted in _onTokenReceived
        emit WithdrawRequested(baseToken, _amount);
    }

    /**
     * @dev Process balance check:
     *  - Confirms a deposit to the remote strategy
     *  - Skips balance update if there's a pending withdrawal
     *  - Updates the remote strategy balance
     * @param message The message containing the nonce and balance
     */
    function _processBalanceCheckMessage(bytes memory message)
        internal
        virtual
    {
        // Decode the message
        (uint64 nonce, uint256 balance) = message.decodeBalanceCheckMessage();

        // Get the last cached nonce
        uint64 _lastCachedNonce = lastTransferNonce;

        if (nonce != _lastCachedNonce) {
            // If nonce is not the last cached nonce, it is an outdated message
            // Ignore it
            return;
        }

        // Check if the nonce has been processed
        bool processedTransfer = isNonceProcessed(nonce);
        if (
            !processedTransfer &&
            transferTypeByNonce[nonce] == TransferType.Withdrawal
        ) {
            // Pending withdrawal is taken care of by _onTokenReceived
            // Do not update balance due to race conditions
            return;
        }

        // Update the remote strategy balance always
        remoteStrategyBalance = balance;
        emit RemoteStrategyBalanceUpdated(balance);

        /**
         * A deposit is being confirmed.
         * A withdrawal will always be confirmed if it reaches this point of code.
         */
        if (!processedTransfer) {
            _markNonceAsProcessed(nonce);

            // Effect of confirming a deposit, reset pending amount
            delete pendingAmount;

            // NOTE: Withdrawal is taken care of by _onTokenReceived
        }
    }
}
