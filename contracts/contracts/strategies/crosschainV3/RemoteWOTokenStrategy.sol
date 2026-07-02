// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20, SafeERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IERC4626 } from "../../../lib/openzeppelin/interfaces/IERC4626.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IBridgeAdapter } from "../../interfaces/crosschainV3/IBridgeAdapter.sol";

import { AbstractWOTokenStrategy } from "./AbstractWOTokenStrategy.sol";
import { CrossChainV3Helper } from "./CrossChainV3Helper.sol";

/**
 * @title RemoteWOTokenStrategy
 * @author Origin Protocol Inc
 *
 * @notice Yield-side leg of the wOToken cross-chain strategy pair. Holds wOToken shares
 *         on behalf of the peer Master. Runs the 2-step pipeline:
 *
 *           inbound : bridgeAsset → OToken (via OToken vault `mint`) → wOToken (via 4626.deposit)
 *           outbound: wOToken (via 4626.withdraw) → OToken → bridgeAsset (via OToken vault redeem)
 *
 *         Remote is NOT registered with any vault — it's a custodian for shares held on
 *         behalf of the peer Master. The `oTokenVault` parameter points at the local
 *         OToken vault on this chain (e.g. the OUSD vault on Ethereum or the OETH vault
 *         on Ethereum).
 *
 *         For the full Remote state-transition table (Idle → Requested → Claimed → Bridging-out
 *         → Completed) see `FLOWS.md`.
 */
contract RemoteWOTokenStrategy is AbstractWOTokenStrategy {
    using SafeERC20 for IERC20;

    // --- Immutables --------------------------------------------------------

    /// @notice ERC-4626 wrapper of the OToken (wOUSD or wOETH).
    address public immutable woToken;

    /// @notice Yield-side OToken vault. Used to convert bridgeAsset ↔ OToken via mint / redeem.
    address public immutable oTokenVault;

    /// @notice Sentinel value of `outstandingRequestId` meaning "no outstanding queue request".
    ///         Using `type(uint256).max` (not 0) lets the vault's real `requestId` — which starts
    ///         at 0 for the first-ever withdrawal on a fresh vault — be stored verbatim.
    uint256 internal constant REQUEST_ID_EMPTY = type(uint256).max;

    // --- Storage (all new slots; nothing from any parent is relocated) -----

    /// @notice OToken-vault queue handle, stored verbatim (the vault's `requestId`).
    ///         `REQUEST_ID_EMPTY` (= `type(uint256).max`) means "no outstanding (unclaimed) queue
    ///         request"; initialised to it in `initialize` since the storage default of 0 is a
    ///         valid vault id. Reset to `REQUEST_ID_EMPTY` once the claim lands.
    uint256 public outstandingRequestId;

    /// @notice Originally-requested bridgeAsset amount for the outstanding withdrawal.
    ///         Set in `_processWithdrawRequest`, refined to the actually-claimed amount
    ///         once `_opportunisticClaim` succeeds, cleared on successful leg-2 delivery.
    ///         Caps the value leg-2 may ship to Master, defeating residual/donation over-send.
    uint256 public outstandingRequestAmount;

    /// @dev Reserved for future expansion.
    uint256[43] private __gap;

    // --- Events -------------------------------------------------------------

    event DepositProcessed(uint64 nonce, uint256 amount, uint256 yieldBaseline);
    event WithdrawRequestProcessed(
        uint64 nonce,
        uint256 amount,
        uint256 requestId
    );
    event WithdrawClaimDelivered(
        uint64 nonce,
        uint256 amount,
        uint256 yieldBaseline
    );
    event WithdrawClaimNack(uint64 nonce, uint256 yieldBaseline);
    event RemoteWithdrawalClaimed(uint256 requestId, uint256 amount);
    /// @dev DEPOSIT mint/wrap reverted; bridgeAsset/oToken left idle (recoverable via retryDeposit).
    event DepositUnderlyingFailed(uint64 nonce, uint256 amount, bytes reason);
    /// @dev WITHDRAW_REQUEST unwrap/queue reverted; nothing queued, Master told to clear pending.
    event WithdrawRequestUnderlyingFailed(
        uint64 nonce,
        uint256 amount,
        bytes reason
    );
    /// @dev Operator re-ran the mint/wrap pipeline on idle bridgeAsset/oToken.
    event IdleDepositRetried(uint256 mintedBridgeAsset, uint256 wrappedOToken);

    // --- Construction / initialisation -------------------------------------

    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _bridgeAsset,
        address _oToken,
        address _woToken,
        address _oTokenVault
    ) AbstractWOTokenStrategy(_stratConfig, _bridgeAsset, _oToken) {
        // Remote has no vault and uses `woToken` as its "platform" for the strategy registry.
        require(
            _stratConfig.vaultAddress == address(0),
            "Remote: vault must be zero"
        );
        require(_woToken != address(0), "Remote: woToken required");
        require(_oTokenVault != address(0), "Remote: oTokenVault required");
        require(
            _stratConfig.platformAddress == _woToken,
            "Remote: platform must be woToken"
        );
        woToken = _woToken;
        oTokenVault = _oTokenVault;
        // This is an implementation contract. The governor is set in the proxy contract.
        _setGovernor(address(0));
    }

    function initialize(address _operator) external onlyGovernor initializer {
        operator = _operator;
        // Storage default is 0, which is a valid vault requestId — start at the empty sentinel.
        outstandingRequestId = REQUEST_ID_EMPTY;
        // wOToken is the registry platform token for Remote.
        _initWithPToken(woToken);
    }

    // --- Required strategy overrides ---------------------------------------

    /// @inheritdoc InitializableAbstractStrategy
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256)
    {
        require(_asset == bridgeAsset, "Remote: unsupported asset");
        // _viewCheckBalance is OToken-denominated (18dp); checkBalance reports in bridgeAsset
        // units like every strategy. (The R→M yield reports use the 18dp baseline directly.)
        return _toAsset(_viewCheckBalance());
    }

    /// @inheritdoc InitializableAbstractStrategy
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        // Static (token, spender) pairs the strategy ever transfers through:
        //   bridgeAsset → oTokenVault   (vault.mint pulls WETH on deposit)
        //   oToken      → oTokenVault   (vault.requestWithdrawal pulls OToken on withdraw)
        //   oToken      → woToken       (ERC-4626 deposit / withdraw of OToken shares)
        // One-shot: approves to type(uint256).max so the per-op approval dance isn't needed.
        // The dynamic (bridgeAsset → outboundAdapter) pair is managed by `setOutboundAdapter`.
        IERC20(bridgeAsset).safeApprove(oTokenVault, type(uint256).max);
        IERC20(oToken).safeApprove(oTokenVault, type(uint256).max);
        IERC20(oToken).safeApprove(woToken, type(uint256).max);
    }

    /// @inheritdoc InitializableAbstractStrategy
    function deposit(address, uint256)
        external
        view
        override
        onlyVaultOrGovernor
    {
        revert("Remote: use bridge");
    }

    /// @inheritdoc InitializableAbstractStrategy
    function depositAll() external view override onlyVaultOrGovernor {
        revert("Remote: use bridge");
    }

    /// @inheritdoc InitializableAbstractStrategy
    function withdraw(
        address,
        address,
        uint256
    ) external view override onlyVaultOrGovernor {
        revert("Remote: use bridge");
    }

    /// @inheritdoc InitializableAbstractStrategy
    function withdrawAll() external view override onlyVaultOrGovernor {
        revert("Remote: use bridge");
    }

    /// @inheritdoc InitializableAbstractStrategy
    /// @dev Hardened recovery sweep. Remote custodies the L2 vault's backing as `woToken`
    ///      shares (and transiently `oToken`), so block sweeping those alongside the supported
    ///      `bridgeAsset`. Otherwise a `transferToken(woToken, …)` would silently lower
    ///      `_viewCheckBalance` -> `remoteStrategyBalance` and rebase L2 holders down. Mirrors
    ///      `BridgedWOETHStrategy.transferToken`. Genuinely-stuck unrelated tokens stay
    ///      recoverable; true custody recovery goes through the governor upgrade path.
    function transferToken(address _asset, uint256 _amount)
        public
        override
        onlyGovernor
    {
        require(
            _asset != bridgeAsset && _asset != woToken && _asset != oToken,
            "Cannot transfer custody asset"
        );
        IERC20(_asset).safeTransfer(governor(), _amount);
    }

    // --- Inbound dispatch --------------------------------------------------

    function _handleBridgeMessage(
        uint256 amountReceived,
        uint32 msgType,
        uint64 nonce,
        bytes memory body
    ) internal override {
        if (msgType == CrossChainV3Helper.DEPOSIT) {
            _processDeposit(nonce, amountReceived);
        } else if (msgType == CrossChainV3Helper.WITHDRAW_REQUEST) {
            _processWithdrawRequest(nonce, body);
        } else if (msgType == CrossChainV3Helper.WITHDRAW_CLAIM) {
            _processWithdrawClaim(nonce);
        } else if (msgType == CrossChainV3Helper.BRIDGE_OUT) {
            _handleInboundBridgeMessage(msgType, amountReceived, body);
        } else if (msgType == CrossChainV3Helper.BALANCE_CHECK_REQUEST) {
            _processBalanceCheckRequest(nonce, body);
        } else if (msgType == CrossChainV3Helper.SETTLE_BRIDGE_ACCOUNTING) {
            _processSettlement(nonce, body);
        } else {
            revert("Remote: unsupported message type");
        }
    }

    /// @dev Reports the YIELD-ONLY baseline: `_viewCheckBalance() - bridgeAdjustment`.
    ///      This cancels bridge-channel deltas on both sides — for each BRIDGE_OUT,
    ///      `_viewCheckBalance` drops by `net` AND `bridgeAdjustment` drops by `net`, so
    ///      the difference stays constant. Bridge channel becomes invisible at this layer.
    ///
    ///      Master combines this yield-only value with its own `bridgeAdjustment` to
    ///      reconstruct the true backing total via `checkBalance`. The math is consistent
    ///      regardless of whether bridge messages have been processed on Remote yet —
    ///      see the design doc for the full case analysis.
    ///
    ///      DOES NOT call `_acceptYieldNonce`: balance check is non-blocking, read-only,
    ///      and the nonce is echoed back unchanged so Master can validate it's still in
    ///      the same yield epoch.
    function _processBalanceCheckRequest(uint64 nonce, bytes memory payload)
        internal
    {
        uint256 srcTimestamp = CrossChainV3Helper.decodeUint256(payload);
        bytes memory ackPayload = CrossChainV3Helper
            .encodeBalanceCheckResponsePayload(
                _yieldOnlyBaseline(),
                srcTimestamp
            );
        _send(
            address(0),
            0,
            CrossChainV3Helper.BALANCE_CHECK_RESPONSE,
            nonce,
            ackPayload,
            false
        );
    }

    /// @dev Subtracts the snapshot Master sent (NOT `= 0`). Rationale:
    ///
    ///      At Remote-processing time, Remote.bridgeAdjustment may equal Master's snapshot
    ///      (no in-flight ops), or differ by some delta (new bridge op has reached Remote
    ///      between Master sending settle and Remote processing it). By subtracting only
    ///      the exact snapshot, any newer delta is preserved on Remote — and Master does
    ///      the symmetric subtract in `_processSettlementAck`, so both sides converge.
    ///
    ///      The reported balance is yield-only baseline (`_viewCheckBalance - bridgeAdj`
    ///      post-subtract), so even if a new bridge op landed in between, the report is
    ///      consistent with Master's reconstruction.
    function _processSettlement(uint64 nonce, bytes memory body) internal {
        int256 snapshot = abi.decode(body, (int256));
        bridgeAdjustment -= snapshot;
        bytes memory ackPayload = CrossChainV3Helper.encodeUint256(
            _yieldOnlyBaseline()
        );
        _send(
            address(0),
            0,
            CrossChainV3Helper.SETTLE_BRIDGE_ACCOUNTING_ACK,
            nonce,
            ackPayload,
            false
        );
        _acceptYieldNonce(nonce);
    }

    /**
     * @dev Leg 1 of Option 1. Unwrap wOToken → OToken, request a withdrawal from the
     *      Ethereum OToken vault queue, reply to Master with the new view of `checkBalance`.
     *      Master doesn't need the `requestId` (Remote owns the queue lifecycle).
     */
    function _processWithdrawRequest(uint64 nonce, bytes memory payload)
        internal
    {
        uint256 amount = CrossChainV3Helper.decodeUint256(payload);
        require(amount > 0, "Remote: zero withdraw");
        require(
            outstandingRequestId == REQUEST_ID_EMPTY,
            "Remote: queue already busy"
        );

        // `amount` is in bridgeAsset units (what the L2 vault asked back). The wOToken unwrap
        // and the OToken-vault queue operate in OToken (18dp) units.
        uint256 oTokenAmount = _toOToken(amount);

        // Unwrap + queue can revert (insufficient shares, vault queue paused, 4626 edge). A revert
        // must NOT brick the serialized channel, so each external call is guarded individually
        // (mirrors crosschain/CrossChainRemoteStrategy). On failure we queue nothing and tell Master
        // success=false so it clears its pending withdrawal; the next op can proceed. 291's gate makes
        // the insufficient-shares case unreachable in normal flow — this covers the residual reverts.
        // Non-atomic: if the unwrap succeeds but the queue fails, the unwrapped OToken is left idle
        // here (counted by _viewCheckBalance, re-wrappable via retryDeposit) rather than rolled back.
        bool success = false;
        uint256 requestId = 0;
        bool unwrapped = false;
        try
            IERC4626(woToken).withdraw(
                oTokenAmount,
                address(this),
                address(this)
            )
        returns (uint256) {
            unwrapped = true;
        } catch (bytes memory reason) {
            emit WithdrawRequestUnderlyingFailed(nonce, amount, reason);
        }
        if (unwrapped) {
            try IVault(oTokenVault).requestWithdrawal(oTokenAmount) returns (
                uint256 id,
                uint256
            ) {
                // Store the vault id verbatim — `REQUEST_ID_EMPTY` is the "no request" sentinel,
                // so a real id of 0 (first withdrawal on a fresh vault) is unambiguous.
                // slither-disable-next-line reentrancy-no-eth
                outstandingRequestId = id;
                // outstandingRequestAmount tracks the bridgeAsset value leg 2 will ship back.
                outstandingRequestAmount = amount;
                requestId = id;
                success = true;
            } catch (bytes memory reason) {
                emit WithdrawRequestUnderlyingFailed(nonce, amount, reason);
            }
        }

        // Reply to Master with the new total and whether the queue was created.
        uint256 yieldBaseline = _yieldOnlyBaseline();
        bytes memory ackPayload = CrossChainV3Helper
            .encodeWithdrawRequestAckPayload(yieldBaseline, success);
        _send(
            address(0),
            0,
            CrossChainV3Helper.WITHDRAW_REQUEST_ACK,
            nonce,
            ackPayload,
            false
        );
        _acceptYieldNonce(nonce);

        emit WithdrawRequestProcessed(nonce, amount, requestId);
    }

    /**
     * @dev Leg 2 of Option 1. If the OToken-vault queue hasn't been claimed yet, try the
     *      claim opportunistically. If the bridgeAsset is in hand, bridge it back to Master.
     *      Otherwise reply with a NACK so Master can retry later.
     */
    function _processWithdrawClaim(uint64 nonce) internal {
        // Best-effort claim (idempotent — early-returns if already claimed).
        _opportunisticClaim();

        // Ship only when the queue actually paid out THIS cycle. `_opportunisticClaim` zeroes
        // `outstandingRequestId` only on a successful claim, so it's the authoritative
        // "claim landed" signal — gating on it (not just held balance) stops a bridgeAsset
        // donation during the queue-delay window from being shipped as the proceeds and
        // permanently orphaning the still-pending queue request. `outstandingRequestAmount`
        // (refined to the claimed amount in `_opportunisticClaim`) caps the ship to the real
        // amount, so any donation stays behind and is realised as yield on the next report.
        uint256 amount = outstandingRequestAmount;
        uint256 bridgeAssetHeld = IERC20(bridgeAsset).balanceOf(address(this));

        // Defense-in-depth: if the claimed amount is outside the outbound adapter's
        // [min, max], the leg-2 ship would revert inside the adapter and brick the yield
        // channel (the nonce never gets accepted). NACK instead so the channel stays live and
        // the claimed bridgeAsset remains counted on Remote (recoverable). Master's leg-1
        // pre-check (mirror-lane bounds) should prevent reaching this; it only fires on a
        // bounds desync between Master's inbound and Remote's outbound configuration.
        uint256 minT = IBridgeAdapter(outboundAdapter).minTransferAmount();
        uint256 maxT = IBridgeAdapter(outboundAdapter).maxTransferAmount();
        bool shipOutOfBounds = amount < minT || (maxT != 0 && amount > maxT);

        if (
            outstandingRequestId != REQUEST_ID_EMPTY ||
            amount == 0 ||
            bridgeAssetHeld < amount ||
            shipOutOfBounds
        ) {
            // Claim not landed / no request / un-shippable amount: NACK so Master can retry.
            uint256 currentBalance = _yieldOnlyBaseline();
            bytes memory nackPayload = CrossChainV3Helper
                .encodeWithdrawClaimAckPayload(currentBalance, false, 0);
            _send(
                address(0),
                0,
                CrossChainV3Helper.WITHDRAW_CLAIM_ACK,
                nonce,
                nackPayload,
                false
            );
            _acceptYieldNonce(nonce);
            emit WithdrawClaimNack(nonce, currentBalance);
            return;
        }

        // Clear queue-side state (re-set if a fresh leg 1 starts) and bridge back.
        // outstandingRequestId is already empty here (the guard NACKs otherwise); cleared defensively.
        // slither-disable-next-line reentrancy-no-eth
        outstandingRequestId = REQUEST_ID_EMPTY;
        outstandingRequestAmount = 0;

        // `amount` (bridgeAsset units) is about to leave us; subtract its OToken-equivalent
        // value from the yield baseline.
        uint256 yieldBaseline = _yieldOnlyBaselineAfter(_toOToken(amount));
        bytes memory ackPayload = CrossChainV3Helper
            .encodeWithdrawClaimAckPayload(yieldBaseline, true, amount);
        // bridgeAsset → outboundAdapter allowance is granted by `setOutboundAdapter`.
        _send(
            bridgeAsset,
            amount,
            CrossChainV3Helper.WITHDRAW_CLAIM_ACK,
            nonce,
            ackPayload,
            false
        );
        _acceptYieldNonce(nonce);

        emit WithdrawClaimDelivered(nonce, amount, yieldBaseline);
    }

    /**
     * @notice Permissionless, idempotent: claim the outstanding queue withdrawal if its delay
     *         has elapsed. Safe to call multiple times — early-returns when nothing's pending.
     */
    function claimRemoteWithdrawal() external nonReentrant {
        _opportunisticClaim();
    }

    function _opportunisticClaim() internal {
        // `outstandingRequestId` stores the vault id verbatim.
        uint256 vaultRequestId = outstandingRequestId;
        if (vaultRequestId == REQUEST_ID_EMPTY) {
            return;
        }
        // Hoist `claimed` outside the try so its scope is unambiguous to static
        // analysers (avoids the slither uninitialized-local false-positive that
        // fired when `claimed` was named only in the try-returns clause).
        uint256 claimed;
        // Use try/catch so a not-yet-claimable queue delay doesn't bubble up as a revert.
        try IVault(oTokenVault).claimWithdrawal(vaultRequestId) returns (
            uint256 _claimed
        ) {
            claimed = _claimed;
            // slither-disable-next-line reentrancy-no-eth
            outstandingRequestId = REQUEST_ID_EMPTY;
            // Refine `outstandingRequestAmount` to the vault's actually-returned asset
            // amount so leg-2 ships exactly what the vault paid out. This is a defensive
            // read-back of the authoritative vault value, NOT a rounding correction: the
            // request->claim round-trip is exact (claimed == requested) because the vault
            // stores the queued 18dp amount and returns scaleBy(amount, assetDecimals, 18),
            // which is the identity when bridgeAsset and the vault's asset share decimals.
            outstandingRequestAmount = claimed;
            emit RemoteWithdrawalClaimed(vaultRequestId, claimed);
        } catch {
            // Still queued; leave state unchanged.
        }
    }

    function _processDeposit(uint64 nonce, uint256 amount) internal {
        // bridgeAsset already arrived with the tokens-with-message delivery.
        require(
            IERC20(bridgeAsset).balanceOf(address(this)) >= amount,
            "Remote: deposit asset missing"
        );

        // Mint OToken, then wrap to wOToken. These touch trusted contracts but can still revert
        // (vault paused, 4626 edge). A revert here must NOT brick the serialized yield channel, so
        // each external call is guarded individually (mirrors crosschain/CrossChainRemoteStrategy):
        // on failure the bridgeAsset/oToken stays idle on this strategy — still counted by
        // `_viewCheckBalance`, recoverable via `retryDeposit` — and we still ack Master below.
        try IVault(oTokenVault).mint(amount) {
            // OToken minted; wrapped below.
        } catch (bytes memory reason) {
            emit DepositUnderlyingFailed(nonce, amount, reason);
        }
        uint256 oTokenBalance = IERC20(oToken).balanceOf(address(this));
        if (oTokenBalance > 0) {
            try
                IERC4626(woToken).deposit(oTokenBalance, address(this))
            returns (uint256) {
                // wOToken shares minted to this strategy.
            } catch (bytes memory reason) {
                emit DepositUnderlyingFailed(nonce, amount, reason);
            }
        }

        // Reply to Master with the new balance and mark the yield nonce processed (always — the
        // baseline counts any idle bridgeAsset/oToken, so Master's accounting stays correct).
        uint256 yieldBaseline = _yieldOnlyBaseline();
        bytes memory ackPayload = CrossChainV3Helper.encodeUint256(
            yieldBaseline
        );
        _send(
            address(0),
            0,
            CrossChainV3Helper.DEPOSIT_ACK,
            nonce,
            ackPayload,
            false
        );
        _acceptYieldNonce(nonce);

        emit DepositProcessed(nonce, amount, yieldBaseline);
    }

    /// @dev Mint `mintAmount` of bridgeAsset into OToken via the vault (allowance pre-granted by
    ///      `safeApproveAllTokens`), then wrap all idle OToken into wOToken shares. Used by the
    ///      operator `retryDeposit`, where a revert SHOULD surface (unlike the message path).
    function _mintAndWrap(uint256 mintAmount) internal {
        if (mintAmount > 0) {
            IVault(oTokenVault).mint(mintAmount);
        }
        uint256 oTokenBalance = IERC20(oToken).balanceOf(address(this));
        if (oTokenBalance > 0) {
            IERC4626(woToken).deposit(oTokenBalance, address(this));
        }
    }

    /**
     * @notice Recover a deposit whose mint/wrap previously failed: re-runs the pipeline on any
     *         idle bridgeAsset (mint → OToken) and idle OToken (wrap → wOToken), returning the
     *         stranded value to productive wOToken. `checkBalance` already counts the idle assets,
     *         so this changes nothing for accounting — it just stops the value sitting unproductive.
     * @dev Operator/strategist/governor; reverts loudly if the underlying still fails (unlike the
     *      message path, a manual retry SHOULD surface the error).
     */
    function retryDeposit()
        external
        onlyOperatorGovernorOrStrategist
        nonReentrant
    {
        uint256 idleBridgeAsset = IERC20(bridgeAsset).balanceOf(address(this));
        uint256 oTokenBefore = IERC20(oToken).balanceOf(address(this));
        require(
            idleBridgeAsset > 0 || oTokenBefore > 0,
            "Remote: nothing to retry"
        );
        _mintAndWrap(idleBridgeAsset);
        emit IdleDepositRetried(idleBridgeAsset, oTokenBefore);
    }

    // --- AbstractWOTokenStrategy hooks -------------------------------------

    /// @inheritdoc AbstractWOTokenStrategy
    function _bridgeOutboundMsgType() internal pure override returns (uint32) {
        return CrossChainV3Helper.BRIDGE_IN;
    }

    /// @inheritdoc AbstractWOTokenStrategy
    /// @dev Bridging out of Remote wraps the user's own OToken, so there's no Remote-side
    ///      liquidity ceiling — the bound is the user's balance. Report unbounded.
    function availableBridgeLiquidity() public pure override returns (uint256) {
        return type(uint256).max;
    }

    /// @inheritdoc AbstractWOTokenStrategy
    function _consumeOTokenForBridge(uint256 amount) internal override {
        // Pull OToken from the user and wrap into wOToken shares held by this strategy.
        IERC20(oToken).safeTransferFrom(msg.sender, address(this), amount);
        IERC4626(woToken).deposit(amount, address(this));
    }

    /// @inheritdoc AbstractWOTokenStrategy
    function _deliverOTokenForBridge(uint256 amount, address recipient)
        internal
        override
    {
        // Defensive: ensure we actually hold enough OToken value to satisfy this bridge-out.
        uint256 sharesNeeded = IERC4626(woToken).previewWithdraw(amount);
        require(
            IERC20(woToken).balanceOf(address(this)) >= sharesNeeded,
            "Remote: insufficient remote wOToken"
        );

        IERC4626(woToken).withdraw(amount, address(this), address(this));
        IERC20(oToken).safeTransfer(recipient, amount);
    }

    // --- Helpers -----------------------------------------------------------

    function _viewCheckBalance() internal view returns (uint256) {
        // Denominated in OToken (18dp). Value lives in exactly one slot at any time per the
        // state-transition table:
        //   - shares       (4626-wrapped wOToken) — OToken units
        //   - oToken       (unwrapped but not yet queued / redeemed) — OToken units
        //   - bridgeAsset  (claimed / redeemed but not yet bridged back) — bridgeAsset units,
        //                   scaled up to OToken units here
        //   - the OToken-vault queue — tracked by outstandingRequestAmount (bridgeAsset units,
        //                   scaled up), counted only while the request is still outstanding
        uint256 sharesBalance = IERC20(woToken).balanceOf(address(this));
        uint256 valueOfShares = sharesBalance == 0
            ? 0
            : IERC4626(woToken).previewRedeem(sharesBalance);
        uint256 queued = outstandingRequestId != REQUEST_ID_EMPTY
            ? _toOToken(outstandingRequestAmount)
            : 0;
        return
            valueOfShares +
            IERC20(oToken).balanceOf(address(this)) +
            _toOToken(IERC20(bridgeAsset).balanceOf(address(this))) +
            queued;
    }

    /// @dev Remote's yield-only baseline = full custody value minus the bridge-channel
    ///      delta. `Master.remoteStrategyBalance` must hold exactly this, because
    ///      `Master.checkBalance` re-adds its OWN `bridgeAdjustment` separately — so every
    ///      R→M balance report routes through here (deposit / withdraw / claim acks, not
    ///      just balance-check / settle).
    function _yieldOnlyBaseline() internal view returns (uint256) {
        return _yieldOnlyBaselineAfter(0);
    }

    /// @dev Yield-only baseline as it will stand AFTER `oTokenAmount` of OToken value leaves
    ///      on a WITHDRAW_CLAIM_ACK (the bridgeAsset is still held when this is computed).
    ///      `oTokenAmount` is in OToken (18dp) units, matching `_viewCheckBalance`;
    ///      `_yieldOnlyBaseline()` is the `oTokenAmount == 0` case.
    /// @dev Clamps to 0 rather than reverting on a negative. `_viewCheckBalance - bridgeAdjustment`
    ///      is principal + yield + retained fees and is never *economically* negative, but the
    ///      wOToken ERC-4626 rounds against the strategy by ~1 wei on each BRIDGE_IN (floor) /
    ///      BRIDGE_OUT (ceil), so once a `withdrawAll` drains this near 0 a later bridge op can push
    ///      it a few wei negative. Reverting there would freeze the whole serialized yield channel on
    ///      dust; clamping reports a dust-accurate 0 instead (and matches the project-wide
    ///      checkBalance-never-reverts convention). The accumulated drift is economically nil.
    function _yieldOnlyBaselineAfter(uint256 oTokenAmount)
        internal
        view
        returns (uint256)
    {
        int256 v = int256(_viewCheckBalance()) -
            int256(oTokenAmount) -
            bridgeAdjustment;
        return v > 0 ? uint256(v) : 0;
    }
}
