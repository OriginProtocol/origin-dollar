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

    /**
     * @notice Remote strategy balance
     * @dev    The remote balance is cached and might not reflect the actual
     *         real-time balance of the remote strategy.
     */
    uint256 public remoteStrategyBalance;

    /// @notice Amount that's bridged due to a pending Deposit process
    ///         but with no acknowledgement from the remote strategy yet
    uint256 public pendingAmount;

    uint256 internal constant MAX_BALANCE_CHECK_AGE = 1 days;

    event RemoteStrategyBalanceUpdated(uint256 balance);
    event WithdrawRequested(address indexed asset, uint256 amount);
    event BalanceCheckIgnored(uint64 nonce, uint256 timestamp, bool isTooOld);

    /**
     * @param _stratConfig The platform and OToken vault addresses
     */
    constructor(
        BaseStrategyConfig memory _stratConfig,
        CCTPIntegrationConfig memory _cctpConfig
    )
        InitializableAbstractStrategy(_stratConfig)
        AbstractCCTPIntegrator(_cctpConfig)
    {
        require(
            _stratConfig.platformAddress == address(0),
            "Invalid platform address"
        );
        require(
            _stratConfig.vaultAddress != address(0),
            "Invalid Vault address"
        );
    }

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
        uint256 balance = IERC20(usdcToken).balanceOf(address(this));
        // Deposit if balance is greater than 1 USDC
        if (balance >= MIN_TRANSFER_AMOUNT) {
            _deposit(usdcToken, balance);
        }
    }

    /// @inheritdoc InitializableAbstractStrategy
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_recipient == vaultAddress, "Only Vault can withdraw");
        _withdraw(_asset, _amount);
    }

    /// @inheritdoc InitializableAbstractStrategy
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        if (isTransferPending()) {
            // Do nothing if there is a pending transfer
            return;
        }

        // Withdraw everything in Remote strategy
        uint256 _remoteBalance = remoteStrategyBalance;
        if (_remoteBalance < MIN_TRANSFER_AMOUNT) {
            // Do nothing if there is less than 1 USDC in the Remote strategy
            return;
        }

        _withdraw(
            usdcToken,
            _remoteBalance > MAX_TRANSFER_AMOUNT
                ? MAX_TRANSFER_AMOUNT
                : _remoteBalance
        );
    }

    /**
     * @notice Check the balance of the strategy that includes
     *          the balance of the asset on this contract,
     *          the amount of the asset being bridged,
     *          and the balance reported by the Remote strategy.
     * @param _asset Address of the asset to check
     * @return balance Total balance of the asset
     */
    function checkBalance(address _asset)
        public
        view
        override
        returns (uint256 balance)
    {
        require(_asset == usdcToken, "Unsupported asset");

        // USDC balance on this contract
        // + USDC being bridged
        // + USDC cached in the corresponding Remote part of this contract
        return
            IERC20(usdcToken).balanceOf(address(this)) +
            pendingAmount +
            remoteStrategyBalance;
    }

    /// @inheritdoc InitializableAbstractStrategy
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == usdcToken;
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
        uint256 usdcBalance = IERC20(usdcToken).balanceOf(address(this));
        // Should always have enough tokens
        require(usdcBalance >= tokenAmount, "Insufficient balance");
        // Transfer all tokens to the Vault to not leave any dust
        IERC20(usdcToken).safeTransfer(vaultAddress, usdcBalance);

        // Emit withdrawal amount
        emit Withdrawal(usdcToken, usdcToken, usdcBalance);
    }

    /**
     * @dev Bridge and deposit asset into the remote strategy
     * @param _asset Address of the asset to deposit
     * @param depositAmount Amount of the asset to deposit
     */
    function _deposit(address _asset, uint256 depositAmount) internal virtual {
        require(_asset == usdcToken, "Unsupported asset");
        require(pendingAmount == 0, "Unexpected pending amount");
        // Deposit at least 1 USDC
        require(
            depositAmount >= MIN_TRANSFER_AMOUNT,
            "Deposit amount too small"
        );
        require(
            depositAmount <= MAX_TRANSFER_AMOUNT,
            "Deposit amount too high"
        );

        // Get the next nonce
        // Note: reverts if a transfer is pending
        uint64 nonce = _getNextNonce();

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
     * @param _amount Amount of the asset to withdraw
     */
    function _withdraw(address _asset, uint256 _amount) internal virtual {
        require(_asset == usdcToken, "Unsupported asset");
        // Withdraw at least 1 USDC
        require(_amount >= MIN_TRANSFER_AMOUNT, "Withdraw amount too small");
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

        // Build and send withdrawal message with payload
        bytes memory message = CrossChainStrategyHelper.encodeWithdrawMessage(
            nonce,
            _amount
        );
        _sendMessage(message);

        // Emit WithdrawRequested event here,
        // Withdraw will be emitted in _onTokenReceived
        emit WithdrawRequested(usdcToken, _amount);
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
        // When transferConfirmation is true, it means that the message is a result of a deposit or a withdrawal
        // process.
        (
            uint64 nonce,
            uint256 balance,
            bool transferConfirmation,
            uint256 timestamp
        ) = message.decodeBalanceCheckMessage();
        // Get the last cached nonce
        uint64 _lastCachedNonce = lastTransferNonce;

        if (nonce != _lastCachedNonce) {
            // If nonce is not the last cached nonce, it is an outdated message
            // Ignore it
            return;
        }

        // A received message nonce not yet processed indicates there is a
        // deposit or withdrawal in progress.
        bool transferInProgress = isTransferPending();

        if (transferInProgress) {
            if (transferConfirmation) {
                // Apply the effects of the deposit / withdrawal completion
                _markNonceAsProcessed(nonce);
                pendingAmount = 0;
            } else {
                // A balanceCheck arrived that is not part of the deposit / withdrawal process
                // that has been generated on the Remote contract after the deposit / withdrawal which is
                // still pending. This can happen when the CCTP bridge delivers the messages out of order.
                // Ignore it, since the pending deposit / withdrawal must first be cofirmed.
                emit BalanceCheckIgnored(nonce, timestamp, false);
                return;
            }
        } else {
            if (block.timestamp > timestamp + MAX_BALANCE_CHECK_AGE) {
                // Balance check is too old, ignore it
                emit BalanceCheckIgnored(nonce, timestamp, true);
                return;
            }
        }

        // At this point update the strategy balance the balanceCheck message is either:
        // - a confirmation of a deposit / withdrawal
        // - a message that updates balances when no deposit / withdrawal is in progress
        remoteStrategyBalance = balance;
        emit RemoteStrategyBalanceUpdated(balance);
    }
}
