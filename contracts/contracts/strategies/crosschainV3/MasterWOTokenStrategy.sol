// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20, SafeERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IVault } from "../../interfaces/IVault.sol";

import { AbstractWOTokenStrategy } from "./AbstractWOTokenStrategy.sol";
import { CrossChainV3Helper } from "./CrossChainV3Helper.sol";

/**
 * @title MasterWOTokenStrategy
 * @author Origin Protocol Inc
 *
 * @notice L2-side leg of the wOToken cross-chain strategy pair. Registered with the L2 vault;
 *         orchestrates deposits, withdrawals, balance checks, and settlement against the
 *         Remote strategy on Ethereum. Bridge-channel mechanics (`bridgeOTokenToPeer`,
 *         inbound BRIDGE_IN handling, replay protection, signed `bridgeAdjustment`
 *         bookkeeping) live in `AbstractWOTokenStrategy` and are wired here via four hooks.
 *
 *         Master is intentionally dumb on the withdrawal queue. It never sees a `requestId`,
 *         never tracks per-withdrawal state beyond a single in-flight amount flag — Remote
 *         owns the queue lifecycle. See the V3 design plan for the full state-transition table.
 */
contract MasterWOTokenStrategy is AbstractWOTokenStrategy {
    using SafeERC20 for IERC20;

    // --- Storage (all new slots; nothing from any parent is relocated) -----

    /// @notice Last reported Remote balance, denominated in `bridgeAsset` units.
    ///         Updated by each yield-channel ack (deposit, withdrawal, balance check, settlement).
    uint256 public remoteStrategyBalance;

    /// @notice In-flight deposit amount (zero when no deposit is pending).
    ///         Part of `checkBalance` so that bridged-but-not-yet-acked tokens stay accounted for.
    uint256 public pendingAmount;

    /// @notice In-flight withdrawal amount (zero when no withdrawal is pending). Pure state flag —
    ///         NOT part of `checkBalance` because the value is already covered by the stale
    ///         `remoteStrategyBalance` until the leg-2 ack lands.
    uint256 public pendingWithdrawalAmount;

    /// @dev Reserved for future expansion.
    uint256[42] private __gap;

    // --- Events -------------------------------------------------------------

    event RemoteStrategyBalanceUpdated(uint256 newBalance);
    event DepositRequested(uint64 nonce, uint256 amount);
    event DepositAcked(uint64 nonce, uint256 newBalance);
    event WithdrawRequested(uint64 nonce, uint256 amount);
    event WithdrawRequestAcked(uint64 nonce, uint256 newBalance);
    event WithdrawClaimTriggered(uint64 nonce, uint256 amount);
    event WithdrawClaimAcked(uint64 nonce, uint256 newBalance, bool success);
    event BalanceCheckRequested(uint64 nonce, uint256 timestamp);
    event BalanceCheckResponded(
        uint64 nonce,
        uint256 newBalance,
        uint256 remoteTimestamp
    );
    event SettlementRequested(uint64 nonce, int256 unsettledAtRequest);
    event SettlementAcked(uint64 nonce, uint256 newBalance);

    // --- Construction / initialisation -------------------------------------

    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _bridgeAsset,
        address _oToken
    ) AbstractWOTokenStrategy(_stratConfig, _bridgeAsset, _oToken) {
        require(
            _stratConfig.platformAddress == address(0),
            "Master: platform must be zero"
        );
        require(
            _stratConfig.vaultAddress != address(0),
            "Master: vault required"
        );
    }

    function initialize(address _operator) external onlyGovernor initializer {
        operator = _operator;

        address[] memory rewardTokens = new address[](0);
        address[] memory assets = new address[](1);
        address[] memory pTokens = new address[](1);
        assets[0] = bridgeAsset;
        pTokens[0] = bridgeAsset; // No pToken; mirror the bridgeAsset for the registry.

        InitializableAbstractStrategy._initialize(
            rewardTokens,
            assets,
            pTokens
        );
    }

    // --- Required strategy overrides ---------------------------------------

    /// @inheritdoc InitializableAbstractStrategy
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256)
    {
        require(_asset == bridgeAsset, "Master: unsupported asset");
        // Local + in-flight deposit + last reported remote balance.
        // pendingWithdrawalAmount is NOT included — value is already in remoteStrategyBalance
        // until the leg-2 ack lands (see state-transition table in the design plan).
        // bridgeAdjustment captures unsettled bridge-channel activity (signed).
        int256 total = int256(
            IERC20(bridgeAsset).balanceOf(address(this)) +
                pendingAmount +
                remoteStrategyBalance
        ) + bridgeAdjustment;
        // Clamp to zero — bridgeAdjustment is bounded by burnForStrategy authorisation
        // (can't be more negative than remoteStrategyBalance + previously settled bridge-in).
        return total > 0 ? uint256(total) : 0;
    }

    /// @inheritdoc InitializableAbstractStrategy
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        // No platform to approve. Outbound adapter is approved on-demand in `_depositToRemote`.
    }

    /// @inheritdoc InitializableAbstractStrategy
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _depositToRemote(_asset, _amount);
    }

    /// @inheritdoc InitializableAbstractStrategy
    function depositAll() external override onlyVault nonReentrant {
        uint256 bal = IERC20(bridgeAsset).balanceOf(address(this));
        if (bal > 0) {
            _depositToRemote(bridgeAsset, bal);
        }
    }

    /// @inheritdoc InitializableAbstractStrategy
    /// @dev Withdrawals are async: this kicks off leg 1 (WITHDRAW_REQUEST). The actual
    ///      tokens land later when `triggerClaim()` is invoked and the leg-2 ack returns.
    ///      The `_recipient` parameter is informational — Master forwards received bridgeAsset
    ///      to the vault on leg-2 ack regardless of this value.
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_recipient == vaultAddress, "Master: recipient must be vault");
        _withdrawRequest(_asset, _amount);
    }

    /// @inheritdoc InitializableAbstractStrategy
    /// @dev Best-effort sweep: requests withdrawal of `remoteStrategyBalance` if nothing
    ///      else is in flight; otherwise silently no-ops so the vault sweep stays safe.
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        if (
            pendingAmount != 0 ||
            pendingWithdrawalAmount != 0 ||
            isYieldOpInFlight()
        ) {
            return;
        }
        if (remoteStrategyBalance == 0) {
            return;
        }
        _withdrawRequest(bridgeAsset, remoteStrategyBalance);
    }

    // --- Operator entrypoints ---------------------------------------------

    /**
     * @notice Operator-triggered leg 2: instructs Remote to claim from its OToken-vault queue
     *         (if not already done by Ethereum-side automation) and bridge the bridgeAsset back.
     *         Must be called only after a leg-1 ack has been processed (otherwise no
     *         pending withdrawal to claim).
     */
    function triggerClaim()
        external
        nonReentrant
        onlyOperatorGovernorOrStrategist
    {
        require(outboundAdapter != address(0), "Master: outbound not set");
        require(pendingWithdrawalAmount > 0, "Master: no pending withdrawal");
        require(!isYieldOpInFlight(), "Master: yield op in flight");

        uint64 nonce = _getNextYieldNonce();
        _sendYieldMessage(CrossChainV3Helper.WITHDRAW_CLAIM, nonce, "");

        emit WithdrawClaimTriggered(nonce, pendingWithdrawalAmount);
    }

    /**
     * @notice Operator-triggered yield-channel round-trip to refresh `remoteStrategyBalance`
     *         off the back of Remote's `previewRedeem`. Run on a cron (~2h) in production.
     */
    function requestBalanceCheck()
        external
        nonReentrant
        onlyOperatorGovernorOrStrategist
    {
        require(outboundAdapter != address(0), "Master: outbound not set");
        require(!isYieldOpInFlight(), "Master: yield op in flight");
        require(pendingWithdrawalAmount == 0, "Master: withdrawal pending");

        uint64 nonce = _getNextYieldNonce();
        bytes memory payload = CrossChainV3Helper
            .encodeBalanceCheckRequestPayload(block.timestamp);
        _sendYieldMessage(
            CrossChainV3Helper.BALANCE_CHECK_REQUEST,
            nonce,
            payload
        );
        emit BalanceCheckRequested(nonce, block.timestamp);
    }

    /**
     * @notice Operator-triggered settlement: reconcile bridge-channel activity with the yield
     *         channel. Both sides clear their `bridgeAdjustment` after a successful round-trip;
     *         the unsettled value is captured in the new `remoteStrategyBalance`.
     */
    function requestSettlement()
        external
        nonReentrant
        onlyOperatorGovernorOrStrategist
    {
        require(outboundAdapter != address(0), "Master: outbound not set");
        require(!isYieldOpInFlight(), "Master: yield op in flight");
        require(pendingWithdrawalAmount == 0, "Master: withdrawal pending");

        uint64 nonce = _getNextYieldNonce();
        _sendYieldMessage(
            CrossChainV3Helper.SETTLE_BRIDGE_ACCOUNTING,
            nonce,
            ""
        );
        emit SettlementRequested(nonce, bridgeAdjustment);
    }

    // --- Yield channel: deposit --------------------------------------------

    function _depositToRemote(address _asset, uint256 _amount) internal {
        require(_asset == bridgeAsset, "Master: unsupported asset");
        require(_amount > 0, "Master: zero deposit");
        require(outboundAdapter != address(0), "Master: outbound not set");
        require(
            pendingAmount == 0 && pendingWithdrawalAmount == 0,
            "Master: yield op in flight"
        );

        uint64 nonce = _getNextYieldNonce();
        pendingAmount = _amount;

        IERC20(bridgeAsset).safeApprove(outboundAdapter, _amount);
        _sendYieldTokensAndMessage(
            bridgeAsset,
            _amount,
            CrossChainV3Helper.DEPOSIT,
            nonce,
            ""
        );

        emit DepositRequested(nonce, _amount);
        emit Deposit(bridgeAsset, bridgeAsset, _amount);
    }

    // --- Yield channel: withdrawal Option 1 (leg 1) ------------------------

    function _withdrawRequest(address _asset, uint256 _amount) internal {
        require(_asset == bridgeAsset, "Master: unsupported asset");
        require(_amount > 0, "Master: zero withdraw");
        require(outboundAdapter != address(0), "Master: outbound not set");
        require(
            pendingAmount == 0 && pendingWithdrawalAmount == 0,
            "Master: yield op in flight"
        );
        require(
            _amount <= remoteStrategyBalance,
            "Master: amount exceeds remote balance"
        );

        uint64 nonce = _getNextYieldNonce();
        pendingWithdrawalAmount = _amount;

        bytes memory payload = CrossChainV3Helper.encodeAmountPayload(_amount);
        _sendYieldMessage(CrossChainV3Helper.WITHDRAW_REQUEST, nonce, payload);

        emit WithdrawRequested(nonce, _amount);
    }

    // --- Inbound dispatch --------------------------------------------------

    function _handleBridgeMessage(
        uint64 nonce,
        uint256 amount,
        uint8 messageType,
        bytes calldata payload
    ) internal override {
        if (messageType == CrossChainV3Helper.DEPOSIT_ACK) {
            _processYieldDepositAck(nonce, payload);
        } else if (messageType == CrossChainV3Helper.WITHDRAW_REQUEST_ACK) {
            _processWithdrawRequestAck(nonce, payload);
        } else if (messageType == CrossChainV3Helper.WITHDRAW_CLAIM_ACK) {
            _processWithdrawClaimAck(nonce, amount, payload);
        } else if (messageType == CrossChainV3Helper.BRIDGE_IN) {
            _handleInboundBridgeMessage(messageType, amount, payload);
        } else if (messageType == CrossChainV3Helper.BALANCE_CHECK_RESPONSE) {
            _processBalanceCheckResponse(nonce, payload);
        } else if (
            messageType == CrossChainV3Helper.SETTLE_BRIDGE_ACCOUNTING_ACK
        ) {
            _processSettlementAck(nonce, payload);
        } else {
            revert("Master: unsupported message type");
        }
    }

    function _processBalanceCheckResponse(uint64 nonce, bytes calldata payload)
        internal
    {
        _markYieldNonceProcessed(nonce);
        (uint256 newBalance, uint256 remoteTimestamp) = CrossChainV3Helper
            .decodeBalanceCheckResponsePayload(payload);
        remoteStrategyBalance = newBalance;
        emit BalanceCheckResponded(nonce, newBalance, remoteTimestamp);
        emit RemoteStrategyBalanceUpdated(newBalance);
    }

    function _processSettlementAck(uint64 nonce, bytes calldata payload)
        internal
    {
        _markYieldNonceProcessed(nonce);
        uint256 newBalance = CrossChainV3Helper.decodeNewBalancePayload(
            payload
        );
        // Master's unsettled bridge delta is now folded into the fresh balance.
        bridgeAdjustment = 0;
        remoteStrategyBalance = newBalance;
        emit SettlementAcked(nonce, newBalance);
        emit RemoteStrategyBalanceUpdated(newBalance);
    }

    function _processWithdrawRequestAck(uint64 nonce, bytes calldata payload)
        internal
    {
        _markYieldNonceProcessed(nonce);
        uint256 newBalance = CrossChainV3Helper.decodeNewBalancePayload(
            payload
        );
        remoteStrategyBalance = newBalance;
        // pendingWithdrawalAmount stays set — gates concurrent triggerClaim() calls
        // until the leg-2 ack lands.
        emit WithdrawRequestAcked(nonce, newBalance);
        emit RemoteStrategyBalanceUpdated(newBalance);
    }

    function _processWithdrawClaimAck(
        uint64 nonce,
        uint256 amount,
        bytes calldata payload
    ) internal {
        _markYieldNonceProcessed(nonce);
        (
            uint256 newBalance,
            bool success,
            uint256 ackAmount
        ) = CrossChainV3Helper.decodeWithdrawClaimAckPayload(payload);

        if (success) {
            // Tokens arrived alongside the ack. Forward what landed to the vault.
            require(amount > 0, "Master: claim ack missing tokens");
            require(amount == ackAmount, "Master: claim amount mismatch");
            require(
                amount <= pendingWithdrawalAmount,
                "Master: claim amount above pending"
            );
            pendingWithdrawalAmount = 0;
            // Forward delivered bridgeAsset to the vault.
            uint256 bal = IERC20(bridgeAsset).balanceOf(address(this));
            if (bal > 0) {
                IERC20(bridgeAsset).safeTransfer(vaultAddress, bal);
                emit Withdrawal(bridgeAsset, bridgeAsset, bal);
            }
        }
        // Either way, update remoteStrategyBalance to Remote's current view.
        remoteStrategyBalance = newBalance;
        emit WithdrawClaimAcked(nonce, newBalance, success);
        emit RemoteStrategyBalanceUpdated(newBalance);
    }

    function _processYieldDepositAck(uint64 nonce, bytes calldata payload)
        internal
    {
        _markYieldNonceProcessed(nonce);
        uint256 newBalance = CrossChainV3Helper.decodeNewBalancePayload(
            payload
        );
        remoteStrategyBalance = newBalance;
        pendingAmount = 0;
        emit DepositAcked(nonce, newBalance);
        emit RemoteStrategyBalanceUpdated(newBalance);
    }

    // --- AbstractWOTokenStrategy hooks -------------------------------------

    /// @inheritdoc AbstractWOTokenStrategy
    function _bridgeOutboundMsgType() internal pure override returns (uint32) {
        return CrossChainV3Helper.BRIDGE_OUT;
    }

    /// @inheritdoc AbstractWOTokenStrategy
    function _preflightBridgeOutbound(uint256 amount) internal view override {
        // Liquidity check: Remote's reported balance plus any unsettled bridge-channel
        // delta must cover the bridge-out.
        int256 available = int256(remoteStrategyBalance) + bridgeAdjustment;
        require(
            available >= int256(amount),
            "Master: insufficient remote liquidity"
        );
    }

    /// @inheritdoc AbstractWOTokenStrategy
    function _consumeOTokenForBridge(uint256 amount) internal override {
        // Pull OToken from the user and burn it via the vault.
        IERC20(oToken).safeTransferFrom(msg.sender, address(this), amount);
        IVault(vaultAddress).burnForStrategy(amount);
    }

    /// @inheritdoc AbstractWOTokenStrategy
    function _deliverOTokenForBridge(uint256 amount, address recipient)
        internal
        override
    {
        IVault(vaultAddress).mintForStrategy(amount);
        IERC20(oToken).safeTransfer(recipient, amount);
    }
}
