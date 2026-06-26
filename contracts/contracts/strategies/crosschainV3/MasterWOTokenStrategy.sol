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
 *         owns the queue lifecycle. See `FLOWS.md` (Remote state-transition table) and `DESIGN.md`.
 */
contract MasterWOTokenStrategy is AbstractWOTokenStrategy {
    using SafeERC20 for IERC20;

    // --- Storage (all new slots; nothing from any parent is relocated) -----

    /// @notice Last reported Remote yield-only baseline, denominated in **OToken (18dp)** units
    ///         (Remote always reports `_yieldOnlyBaseline()`, never its bridgeAsset checkBalance).
    ///         Scaled down to bridgeAsset units at the checkBalance / withdraw seams via
    ///         `_toAsset`. Updated by each yield-channel ack (deposit, withdrawal, balance check,
    ///         settlement).
    uint256 public remoteStrategyBalance;

    /// @notice In-flight deposit amount (zero when no deposit is pending).
    ///         Part of `checkBalance` so that bridged-but-not-yet-acked tokens stay accounted for.
    uint256 public pendingDepositAmount;

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

    event RemoteStrategyBalanceUpdated(uint256 yieldBaseline);
    event DepositRequested(uint64 nonce, uint256 amount);
    event DepositAcked(uint64 nonce, uint256 yieldBaseline);
    event WithdrawRequested(uint64 nonce, uint256 amount);
    event WithdrawRequestAcked(uint64 nonce, uint256 yieldBaseline);
    event WithdrawClaimTriggered(uint64 nonce, uint256 amount);
    event WithdrawClaimAcked(uint64 nonce, uint256 yieldBaseline, bool success);
    event BalanceCheckRequested(uint64 nonce, uint256 timestamp);
    event BalanceCheckResponded(
        uint64 nonce,
        uint256 yieldBaseline,
        uint256 remoteTimestamp
    );
    event SettlementRequested(uint64 nonce, int256 bridgeAdjustmentSnapshot);
    event SettlementAcked(uint64 nonce, uint256 yieldBaseline);

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
        // This is an implementation contract. The governor is set in the proxy contract.
        _setGovernor(address(0));
    }

    function initialize(address _operator) external onlyGovernor initializer {
        operator = _operator;
        // No real platform; mirror the bridgeAsset as the registry pToken.
        _initWithPToken(bridgeAsset);
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
        // Two domains (see AbstractWOTokenStrategy decimal-scaling note):
        //   - local bridgeAsset balance + in-flight deposit are in bridgeAsset units.
        //   - remoteStrategyBalance + bridgeAdjustment are OToken (18dp) units; the signed
        //     bridgeAdjustment captures unsettled bridge-channel activity.
        // Clamp the OToken block to zero, scale it down to bridgeAsset units, then add the
        // bridgeAsset-denominated locals. pendingWithdrawalAmount is NOT included — its value
        // is still in remoteStrategyBalance until the leg-2 ack lands.
        int256 remote = int256(remoteStrategyBalance) + bridgeAdjustment;
        uint256 remoteInAsset = remote > 0 ? _toAsset(uint256(remote)) : 0;
        return
            IERC20(bridgeAsset).balanceOf(address(this)) +
            pendingDepositAmount +
            remoteInAsset;
    }

    /// @inheritdoc InitializableAbstractStrategy
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        // No platform to approve. The bridgeAsset → outbound adapter allowance is the only
        // approval Master needs, and it's (re)granted in `_setOutboundAdapter`.
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
    /// @dev Withdrawals are async: this kicks off leg 1 (WITHDRAW_REQUEST). The actual tokens
    ///      land later when `triggerClaim()` is invoked and the leg-2 ack returns. `_recipient`
    ///      must equal the vault (enforced by the require below); Master always forwards the
    ///      received bridgeAsset to `vaultAddress` on the leg-2 ack.
    ///
    ///      Only the `remoteStrategyBalance` slice is drawable here: `_amount` must be
    ///      `<= remoteStrategyBalance` even though `checkBalance` can report more (local
    ///      bridgeAsset + positive bridgeAdjustment). To realise the remainder, the strategist
    ///      can `requestSettlement()` (folding bridgeAdjustment into remoteStrategyBalance)
    ///      and/or use the locally-held bridgeAsset, then withdraw.
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
            pendingDepositAmount != 0 ||
            pendingWithdrawalAmount != 0 ||
            isYieldOpInFlight()
        ) {
            return;
        }
        // Best-effort: a mid-migration cleared inbound adapter must no-op the sweep, not
        // revert it (honors the "best-effort no-op" contract).
        address inbound = inboundAdapter;
        if (inbound == address(0)) return;
        // remoteStrategyBalance is OToken (18dp); withdraw amounts are bridgeAsset units.
        // Use the drawable balance (folds in a negative bridgeAdjustment) so a sweep can't
        // over-request more shares than Remote can actually unwrap.
        uint256 amount = _toAsset(_drawableRemoteBalance());
        if (amount == 0) return;
        uint256 cap = IBridgeAdapter(inbound).maxTransferAmount();
        if (cap > 0 && amount > cap) amount = cap;
        // Don't initiate a sub-floor sweep — leg-2 ship would be rejected by the adapter.
        if (amount < IBridgeAdapter(inbound).minTransferAmount()) return;
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

        // _getNextYieldNonce() enforces !isYieldOpInFlight().
        uint64 nonce = _getNextYieldNonce();
        _send(
            address(0),
            0,
            CrossChainV3Helper.WITHDRAW_CLAIM,
            nonce,
            "",
            false
        );

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
        uint64 nonce = lastYieldNonce; // echo current nonce; do NOT advance it
        bytes memory payload = CrossChainV3Helper.encodeUint256(
            block.timestamp
        );
        // Read-only on Remote's side.
        _send(
            address(0),
            0,
            CrossChainV3Helper.BALANCE_CHECK_REQUEST,
            nonce,
            payload,
            false
        );
        emit BalanceCheckRequested(nonce, block.timestamp);
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
        require(pendingWithdrawalAmount == 0, "Master: withdrawal pending");
        // _getNextYieldNonce() enforces !isYieldOpInFlight().

        uint64 nonce = _getNextYieldNonce();
        // Persist for the ack handler to subtract from the (possibly-evolved) bridgeAdjustment.
        settlementSnapshot = bridgeAdjustment;
        bytes memory payload = abi.encode(settlementSnapshot);
        _send(
            address(0),
            0,
            CrossChainV3Helper.SETTLE_BRIDGE_ACCOUNTING,
            nonce,
            payload,
            false
        );
        emit SettlementRequested(nonce, settlementSnapshot);
    }

    // --- Yield channel: deposit --------------------------------------------

    function _depositToRemote(address _asset, uint256 _amount) internal {
        require(_asset == bridgeAsset, "Master: unsupported asset");
        require(_amount > 0, "Master: zero deposit");
        require(outboundAdapter != address(0), "Master: outbound not set");
        require(
            pendingDepositAmount == 0 && pendingWithdrawalAmount == 0,
            "Master: deposit or withdrawal pending"
        );
        // Best-effort min floor (mirror of the withdraw-side guard in `_withdrawRequest` /
        // `withdrawAll`): a sub-min amount would revert deep inside the adapter on `_send`.
        // No-op instead of reverting — the asset is already on the strategy (the vault
        // transfers it before calling `deposit`) and stays counted in `checkBalance`, so it
        // auto-deposits once enough accumulates. A revert here would DoS the mint ->
        // `_allocate` -> `deposit` path. Covers both `deposit` and `depositAll`.
        if (_amount < IBridgeAdapter(outboundAdapter).minTransferAmount()) {
            return;
        }

        uint64 nonce = _getNextYieldNonce();
        pendingDepositAmount = _amount;

        // bridgeAsset → outboundAdapter allowance is granted once in `_setOutboundAdapter`.
        _send(
            bridgeAsset,
            _amount,
            CrossChainV3Helper.DEPOSIT,
            nonce,
            "",
            false
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
            pendingDepositAmount == 0 && pendingWithdrawalAmount == 0,
            "Master: deposit or withdrawal pending"
        );
        // _amount is bridgeAsset units; gate against the drawable balance in bridgeAsset units.
        // _drawableRemoteBalance folds in a negative bridgeAdjustment so that after a net
        // BRIDGE_OUT the gate can't over-permit a withdrawal Remote couldn't unwrap (it would
        // revert on Remote). Scaling down also rounds conservatively.
        require(
            _amount <= _toAsset(_drawableRemoteBalance()),
            "Master: amount exceeds remote balance"
        );
        // Reject amounts the leg-2 ship can't satisfy, so a withdrawal never commits leg 1
        // and then bricks leg 2. The inbound adapter mirrors Remote's outbound bounds (the
        // lane-mirror convention). Symmetric with the deposit floor (deposits already reject
        // out-of-bounds at the adapter). A withdrawal can't complete without an inbound adapter
        // (leg-2's ack is delivered through it), so require it rather than skipping the checks —
        // `setInboundAdapter` rejects zero, so this only guards the pre-configuration window.
        address inbound = inboundAdapter;
        require(inbound != address(0), "Master: inbound not set");
        require(
            _amount >= IBridgeAdapter(inbound).minTransferAmount(),
            "Master: amount below bridge min"
        );
        uint256 maxT = IBridgeAdapter(inbound).maxTransferAmount();
        require(
            maxT == 0 || _amount <= maxT,
            "Master: amount above bridge max"
        );

        uint64 nonce = _getNextYieldNonce();
        pendingWithdrawalAmount = _amount;

        bytes memory payload = CrossChainV3Helper.encodeUint256(_amount);
        _send(
            address(0),
            0,
            CrossChainV3Helper.WITHDRAW_REQUEST,
            nonce,
            payload,
            false
        );

        emit WithdrawRequested(nonce, _amount);
    }

    // --- Inbound dispatch --------------------------------------------------

    function _handleBridgeMessage(
        uint256 amountReceived,
        uint32 msgType,
        uint64 nonce,
        bytes memory body
    ) internal override {
        if (msgType == CrossChainV3Helper.DEPOSIT_ACK) {
            _processDepositAck(nonce, body);
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
    ///           would race with its ack; ignore to avoid corrupting pendingDepositAmount /
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
        (uint256 yieldBaseline, uint256 remoteTimestamp) = CrossChainV3Helper
            .decodeBalanceCheckResponsePayload(payload);
        if (remoteTimestamp <= lastBalanceCheckTimestamp) return;
        lastBalanceCheckTimestamp = remoteTimestamp;
        remoteStrategyBalance = yieldBaseline;
        emit BalanceCheckResponded(nonce, yieldBaseline, remoteTimestamp);
        emit RemoteStrategyBalanceUpdated(yieldBaseline);
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
    ///        Remote's reported `yieldBaseline` is its yield-only baseline (`_viewCheckBalance
    ///        - bridgeAdjustment` post-subtract), which combined with Master's residual
    ///        bridgeAdjustment gives consistent checkBalance across all orderings.
    function _processSettlementAck(uint64 nonce, bytes memory payload)
        internal
    {
        _markYieldNonceProcessed(nonce);
        uint256 yieldBaseline = CrossChainV3Helper.decodeUint256(payload);
        bridgeAdjustment -= settlementSnapshot;
        settlementSnapshot = 0;
        remoteStrategyBalance = yieldBaseline;
        emit SettlementAcked(nonce, yieldBaseline);
        emit RemoteStrategyBalanceUpdated(yieldBaseline);
    }

    function _processWithdrawRequestAck(uint64 nonce, bytes memory payload)
        internal
    {
        _markYieldNonceProcessed(nonce);
        (uint256 yieldBaseline, bool success) = CrossChainV3Helper
            .decodeWithdrawRequestAckPayload(payload);
        remoteStrategyBalance = yieldBaseline;
        // On success Remote queued the withdrawal — pendingWithdrawalAmount stays set, gating
        // concurrent triggerClaim() calls until the leg-2 ack lands. On failure Remote queued
        // nothing, so clear the pending withdrawal to unblock the channel; it can be re-requested.
        if (!success) {
            pendingWithdrawalAmount = 0;
        }
        emit WithdrawRequestAcked(nonce, yieldBaseline);
        emit RemoteStrategyBalanceUpdated(yieldBaseline);
    }

    function _processWithdrawClaimAck(
        uint64 nonce,
        uint256 amount,
        bytes memory payload
    ) internal {
        _markYieldNonceProcessed(nonce);
        (
            uint256 yieldBaseline,
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
        remoteStrategyBalance = yieldBaseline;
        emit WithdrawClaimAcked(nonce, yieldBaseline, success);
        emit RemoteStrategyBalanceUpdated(yieldBaseline);
    }

    function _processDepositAck(uint64 nonce, bytes memory payload) internal {
        _markYieldNonceProcessed(nonce);
        uint256 yieldBaseline = CrossChainV3Helper.decodeUint256(payload);
        remoteStrategyBalance = yieldBaseline;
        pendingDepositAmount = 0;
        emit DepositAcked(nonce, yieldBaseline);
        emit RemoteStrategyBalanceUpdated(yieldBaseline);
    }

    // --- AbstractWOTokenStrategy hooks -------------------------------------

    /// @inheritdoc AbstractWOTokenStrategy
    function _bridgeOutboundMsgType() internal pure override returns (uint32) {
        return CrossChainV3Helper.BRIDGE_OUT;
    }

    /// @inheritdoc AbstractWOTokenStrategy
    /// @dev Conservative: subtracts the in-flight withdrawal's claim on Remote's shares
    ///      (`pendingWithdrawalAmount`), which `remoteStrategyBalance` still counts until the
    ///      claim-ack lands. Does NOT add the in-flight `pendingDepositAmount` deposit — it isn't yet
    ///      shares on Remote, and a BRIDGE_OUT could race ahead of (or outlive) it, so counting
    ///      it would re-open a stranding window.
    function availableBridgeLiquidity() public view override returns (uint256) {
        // Reported in OToken (18dp) — it gates an OToken bridge (`net`). remoteStrategyBalance
        // and bridgeAdjustment are already 18dp; pendingWithdrawalAmount is bridgeAsset units,
        // so scale it up before subtracting.
        int256 a = int256(remoteStrategyBalance) +
            bridgeAdjustment -
            int256(_toOToken(pendingWithdrawalAmount));
        return a > 0 ? uint256(a) : 0;
    }

    /// @dev OToken (18dp) value Remote can actually unwrap right now. Remote's shares are worth
    ///      `remoteStrategyBalance + bridgeAdjustment`; we fold in only the NEGATIVE part of
    ///      `bridgeAdjustment`. After a net BRIDGE_OUT (which anyone can trigger via
    ///      `bridgeOTokenToPeer`) `bridgeAdjustment < 0` and Remote holds fewer shares than
    ///      `remoteStrategyBalance` implies, so a draw gated on `remoteStrategyBalance` alone would
    ///      over-request and revert on Remote. Positive `bridgeAdjustment` stays excluded here —
    ///      realise it with `requestSettlement()` first — preserving the conservative draw behaviour.
    function _drawableRemoteBalance() internal view returns (uint256) {
        int256 d = int256(remoteStrategyBalance) +
            (bridgeAdjustment < 0 ? bridgeAdjustment : int256(0));
        return d > 0 ? uint256(d) : 0;
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
