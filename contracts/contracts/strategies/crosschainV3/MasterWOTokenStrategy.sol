// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20, SafeERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IBridgeAdapter } from "../../interfaces/crosschainV3/IBridgeAdapter.sol";

import { AbstractWOTokenStrategy } from "./AbstractWOTokenStrategy.sol";
import { CrossChainV3Helper } from "./CrossChainV3Helper.sol";

/**
 * @title MasterWOTokenStrategy
 * @author Origin Protocol Inc
 *
 * @notice Vault-facing leg of the wOToken cross-chain strategy pair. Registered with the
 *         OToken vault on its own chain; orchestrates deposits, withdrawals, balance
 *         checks, and settlement against the Remote strategy on the peer chain. Topology
 *         is deployment-dependent (e.g., for OETHb, Master is on Base and Remote on
 *         Ethereum; for OUSD V3, the topology can be inverted per spoke).
 *         Bridge-channel mechanics (`bridgeOTokenToPeer`,
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

    /// @notice Snapshot of `bridgeAdjustment` captured at the moment `requestSettlement`
    ///         fires. The ack handler subtracts exactly this value (not zero) so that any
    ///         bridge ops processed between request and ack are preserved on both sides.
    ///         See `_processSettlementAck` for rationale.
    int256 public settlementSnapshot;

    /// @dev Reserved for future expansion.
    uint256[41] private __gap;

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
    /// @dev Clamps the local balance by the outbound adapter's `maxTransferAmount` so a
    ///      vault sweep larger than the bridge's per-tx limit lands as a partial deposit
    ///      rather than reverting deep inside the bridge router. Remainder stays on Master
    ///      until the next `depositAll` (or operator-driven sequencing).
    function depositAll() external override onlyVault nonReentrant {
        uint256 bal = IERC20(bridgeAsset).balanceOf(address(this));
        if (bal == 0) return;
        uint256 cap = IBridgeAdapter(outboundAdapter).maxTransferAmount();
        if (cap > 0 && bal > cap) bal = cap;
        _depositToRemote(bridgeAsset, bal);
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
    /// @dev Best-effort sweep: requests withdrawal of `remoteStrategyBalance` (clamped by
    ///      Remote's per-tx bridge cap) if nothing else is in flight; otherwise silently
    ///      no-ops so the vault sweep stays safe.
    ///
    ///      Clamping uses `inboundAdapter.maxTransferAmount()` — Master can't query
    ///      Remote's outbound across chains, but the symmetric inbound adapter on this
    ///      chain holds the same protocol-level cap (outbound and inbound on a lane
    ///      are mirror sides of the same bridge). For OETHb that's the Superbridge cap
    ///      (canonical bridge, typically 0 = unlimited); for OUSD V3 it's the CCTPAdapter
    ///      cap (10M USDC).
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        if (
            pendingAmount != 0 ||
            pendingWithdrawalAmount != 0 ||
            isYieldOpInFlight()
        ) {
            return;
        }
        uint256 amount = remoteStrategyBalance;
        if (amount == 0) return;
        uint256 cap = IBridgeAdapter(inboundAdapter).maxTransferAmount();
        if (cap > 0 && amount > cap) amount = cap;
        _withdrawRequest(bridgeAsset, amount);
    }

    // --- Operator entrypoints ---------------------------------------------

    /**
     * @notice Operator-triggered leg 2: instructs Remote to claim from its OToken-vault queue
     *         (if not already done by peer-chain automation) and bridge the bridgeAsset back.
     *         Must be called only after a leg-1 ack has been processed (otherwise no
     *         pending withdrawal to claim).
     */
    function triggerClaim()
        external
        payable
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
     *
     * @dev    Non-blocking: does NOT advance the yield nonce. Sends with the CURRENT
     *         `lastYieldNonce` as an "epoch marker" — the response is accepted only if
     *         that nonce still matches when the ack lands AND no other yield op is in
     *         flight AND the timestamp is newer than the last accepted check. See
     *         `_processBalanceCheckResponse` for the three-guard logic.
     *
     *         Multiple BCs in flight at the same nonce are harmless; whichever response
     *         is newest wins via the timestamp guard.
     */
    function requestBalanceCheck()
        external
        payable
        nonReentrant
        onlyOperatorGovernorOrStrategist
    {
        require(outboundAdapter != address(0), "Master: outbound not set");
        bytes memory payload = CrossChainV3Helper
            .encodeBalanceCheckRequestPayload(block.timestamp);
        // Echo current nonce; do NOT advance it. Read-only on Remote's side.
        _sendYieldMessage(
            CrossChainV3Helper.BALANCE_CHECK_REQUEST,
            lastYieldNonce,
            payload
        );
        emit BalanceCheckRequested(lastYieldNonce, block.timestamp);
    }

    /**
     * @notice Operator-triggered settlement: zero out (or reduce) `bridgeAdjustment` on
     *         both sides. With the locked design (yield-only baseline in balance check),
     *         settlement is housekeeping — keeps bridgeAdjustment magnitude bounded
     *         rather than being correctness-critical.
     *
     * @dev    Captures `bridgeAdjustment` as a snapshot at request time. Both sides
     *         subtract exactly that snapshot on their respective handlers (NOT `= 0`),
     *         which preserves any bridge ops that happen between request and ack. This
     *         avoids the desync that would occur if both sides naively zeroed while a
     *         new BRIDGE_OUT was mid-flight. See `_processSettlementAck` for the math.
     */
    function requestSettlement()
        external
        payable
        nonReentrant
        onlyOperatorGovernorOrStrategist
    {
        require(outboundAdapter != address(0), "Master: outbound not set");
        require(!isYieldOpInFlight(), "Master: yield op in flight");
        require(pendingWithdrawalAmount == 0, "Master: withdrawal pending");

        uint64 nonce = _getNextYieldNonce();
        // Persist for the ack handler to subtract from the (possibly-evolved) bridgeAdjustment.
        settlementSnapshot = bridgeAdjustment;
        bytes memory payload = abi.encode(settlementSnapshot);
        _sendYieldMessage(
            CrossChainV3Helper.SETTLE_BRIDGE_ACCOUNTING,
            nonce,
            payload
        );
        emit SettlementRequested(nonce, settlementSnapshot);
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
        address, // sender
        address, // token
        uint256 amountReceived,
        uint256, // feePaid — unused for bridge channel / yield message-only ops
        uint32 msgType,
        uint64 nonce,
        bytes memory body
    ) internal override {
        if (msgType == CrossChainV3Helper.DEPOSIT_ACK) {
            _processYieldDepositAck(nonce, body);
        } else if (msgType == CrossChainV3Helper.WITHDRAW_REQUEST_ACK) {
            _processWithdrawRequestAck(nonce, body);
        } else if (msgType == CrossChainV3Helper.WITHDRAW_CLAIM_ACK) {
            _processWithdrawClaimAck(nonce, amountReceived, body);
        } else if (msgType == CrossChainV3Helper.BRIDGE_IN) {
            _handleInboundBridgeMessage(msgType, amountReceived, body);
        } else if (msgType == CrossChainV3Helper.BALANCE_CHECK_RESPONSE) {
            _processBalanceCheckResponse(nonce, body);
        } else if (msgType == CrossChainV3Helper.SETTLE_BRIDGE_ACCOUNTING_ACK) {
            _processSettlementAck(nonce, body);
        } else {
            revert("Master: unsupported message type");
        }
    }

    /// @dev Three-guard acceptance:
    ///        1. `!isYieldOpInFlight()` — if a deposit/withdraw is mid-flight, the response
    ///           would race with its ack; ignore to avoid corrupting pendingAmount /
    ///           remoteStrategyBalance accounting.
    ///        2. `respNonce == lastYieldNonce` — the request was sent at this nonce; if
    ///           lastYieldNonce has since advanced, this response is from a now-stale
    ///           epoch. Ignore.
    ///        3. `respTimestamp > lastBalanceCheckTimestamp` — out-of-order CCIP delivery
    ///           could land an older snapshot after a newer one. Strict monotonic order
    ///           preserves the latest read.
    function _processBalanceCheckResponse(uint64 nonce, bytes memory payload)
        internal
    {
        // No _markYieldNonceProcessed here — balance check did NOT advance the nonce, so
        // there's nothing to mark. The 3 guards below replace nonce-advance semantics.
        if (isYieldOpInFlight()) return;
        if (nonce != lastYieldNonce) return;
        (uint256 newBalance, uint256 remoteTimestamp) = CrossChainV3Helper
            .decodeBalanceCheckResponsePayload(payload);
        if (remoteTimestamp <= lastBalanceCheckTimestamp) return;
        lastBalanceCheckTimestamp = remoteTimestamp;
        remoteStrategyBalance = newBalance;
        emit BalanceCheckResponded(nonce, newBalance, remoteTimestamp);
        emit RemoteStrategyBalanceUpdated(newBalance);
    }

    /// @dev Subtracts `settlementSnapshot` (NOT `= 0`). Rationale:
    ///
    ///        Master.bridgeAdj at ack time may differ from what it was at request time if
    ///        new bridge ops landed in between. Zeroing would erase those new ops. By
    ///        subtracting only the exact snapshot we committed to settling, we preserve
    ///        the post-snapshot delta on both sides — Remote does the symmetric subtract
    ///        in `_processSettlement`, so both sides converge to the same value
    ///        regardless of the order in which bridge ops vs. the settle message reach
    ///        Remote.
    ///
    ///        Remote's reported `newBalance` is its yield-only baseline (`_viewCheckBalance
    ///        - bridgeAdjustment` post-subtract), which combined with Master's residual
    ///        bridgeAdjustment gives consistent checkBalance across all orderings.
    function _processSettlementAck(uint64 nonce, bytes memory payload)
        internal
    {
        _markYieldNonceProcessed(nonce);
        uint256 newBalance = CrossChainV3Helper.decodeNewBalancePayload(
            payload
        );
        bridgeAdjustment -= settlementSnapshot;
        settlementSnapshot = 0;
        remoteStrategyBalance = newBalance;
        emit SettlementAcked(nonce, newBalance);
        emit RemoteStrategyBalanceUpdated(newBalance);
    }

    function _processWithdrawRequestAck(uint64 nonce, bytes memory payload)
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
        bytes memory payload
    ) internal {
        _markYieldNonceProcessed(nonce);
        (
            uint256 newBalance,
            bool success,
            uint256 ackAmount
        ) = CrossChainV3Helper.decodeWithdrawClaimAckPayload(payload);

        if (success) {
            // Tokens arrived alongside the ack. Forward what landed to the vault.
            // `amount <= ackAmount` (not strict equality) so CCTP fast-finality fees
            // are tolerated: the shortfall is the protocol fee, absorbed as yield drag
            // and refreshed on the next BALANCE_CHECK. Mirrors the older
            // `CrossChainMasterStrategy._onTokenReceived` which ignores `feeExecuted`
            // entirely (marked `solhint-disable-next-line no-unused-vars`).
            require(amount > 0, "Master: claim ack missing tokens");
            require(amount <= ackAmount, "Master: claim above ack");
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

    function _processYieldDepositAck(uint64 nonce, bytes memory payload)
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
