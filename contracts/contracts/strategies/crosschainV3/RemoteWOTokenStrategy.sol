// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20, SafeERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IERC4626 } from "../../../lib/openzeppelin/interfaces/IERC4626.sol";
import { IVault } from "../../interfaces/IVault.sol";

// solhint-disable-next-line no-unused-import
import { AbstractCrossChainV3Strategy } from "./AbstractCrossChainV3Strategy.sol";
import { AbstractWOTokenStrategy } from "./AbstractWOTokenStrategy.sol";
import { CrossChainV3Helper } from "./CrossChainV3Helper.sol";

/**
 * @title RemoteWOTokenStrategy
 * @author Origin Protocol Inc
 *
 * @notice Ethereum-side leg of the wOToken cross-chain strategy pair. Holds wOToken shares
 *         on behalf of the L2 vault. Runs the 2-step pipeline:
 *
 *           inbound : bridgeAsset → OToken (via OToken vault `mint`) → wOToken (via 4626.deposit)
 *           outbound: wOToken (via 4626.withdraw) → OToken → bridgeAsset (via OToken vault redeem)
 *
 *         Remote is NOT registered with any vault — it's a custodian for shares held on
 *         behalf of the L2 Master. The `oTokenVault` parameter points at the Ethereum-side
 *         OToken vault (e.g. the mainnet OUSD vault or the mainnet OETH vault).
 *
 *         For the full Remote state-transition table (Idle → Requested → Claimed → Bridging-out
 *         → Completed) see the V3 implementation plan.
 */
contract RemoteWOTokenStrategy is AbstractWOTokenStrategy {
    using SafeERC20 for IERC20;

    // --- Immutables --------------------------------------------------------

    /// @notice ERC-4626 wrapper of the OToken (wOUSD or wOETH).
    address public immutable woToken;

    /// @notice Ethereum-side OToken vault. Used to convert bridgeAsset ↔ OToken via mint / redeem.
    address public immutable oTokenVault;

    // --- Storage (all new slots; nothing from any parent is relocated) -----

    /// @notice OToken-vault queue handle. 0 = no outstanding queue request.
    uint256 public outstandingRequestId;

    /// @notice BridgeAsset value sitting in the OToken vault queue, not yet claimed.
    ///         Set when `requestWithdrawal` runs, cleared when `claimWithdrawal` succeeds.
    uint256 public queuedAmount;

    /// @notice Originally-requested bridgeAsset amount for the outstanding withdrawal.
    ///         Set in `_processWithdrawRequest`, refined to the actually-claimed amount
    ///         once `_opportunisticClaim` succeeds, cleared on successful leg-2 delivery.
    ///         Caps the value leg-2 may ship to Master, defeating residual/donation over-send.
    uint256 public outstandingRequestAmount;

    /// @dev Reserved for future expansion.
    uint256[42] private __gap;

    // --- Events -------------------------------------------------------------

    event YieldDepositProcessed(
        uint64 nonce,
        uint256 amount,
        uint256 newBalance
    );
    event WithdrawRequestProcessed(
        uint64 nonce,
        uint256 amount,
        uint256 requestId
    );
    event WithdrawClaimDelivered(
        uint64 nonce,
        uint256 amount,
        uint256 newBalance
    );
    event WithdrawClaimNack(uint64 nonce, uint256 newBalance);
    event RemoteWithdrawalClaimed(uint256 requestId, uint256 amount);

    // --- Construction / initialisation -------------------------------------

    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _bridgeAsset,
        address _oToken,
        address _woToken,
        address _oTokenVault
    ) AbstractWOTokenStrategy(_stratConfig, _bridgeAsset, _oToken) {
        // Remote has no L2 vault and uses `woToken` as its "platform" for the strategy registry.
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
    }

    function initialize(address _operator) external onlyGovernor initializer {
        operator = _operator;

        address[] memory rewardTokens = new address[](0);
        address[] memory assets = new address[](1);
        address[] memory pTokens = new address[](1);
        assets[0] = bridgeAsset;
        pTokens[0] = woToken;

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
        require(_asset == bridgeAsset, "Remote: unsupported asset");
        return _viewCheckBalance();
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

    /**
     * @inheritdoc AbstractCrossChainV3Strategy
     * @dev Rotates the bridgeAsset allowance from the old adapter to the new one so leg-2
     *      ship doesn't need a per-call approve.
     */
    function _setOutboundAdapter(address _outboundAdapter)
        internal
        virtual
        override
    {
        address old = outboundAdapter;
        if (old != address(0) && old != _outboundAdapter) {
            IERC20(bridgeAsset).safeApprove(old, 0);
        }
        super._setOutboundAdapter(_outboundAdapter);
        if (_outboundAdapter != address(0) && old != _outboundAdapter) {
            IERC20(bridgeAsset).safeApprove(
                _outboundAdapter,
                type(uint256).max
            );
        }
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

    // --- Inbound dispatch --------------------------------------------------

    function _handleBridgeMessage(
        address, // sender
        address, // token
        uint256 amountReceived,
        uint256, // feePaid
        uint32 msgType,
        uint64 nonce,
        bytes memory body
    ) internal override {
        if (msgType == CrossChainV3Helper.DEPOSIT) {
            _processYieldDeposit(nonce, amountReceived);
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
        uint256 srcTimestamp = CrossChainV3Helper
            .decodeBalanceCheckRequestPayload(payload);
        int256 yieldOnly = int256(_viewCheckBalance()) - bridgeAdjustment;
        // Defensive: yield-only baseline should never go negative in healthy operation.
        // Each BRIDGE_IN increases `_viewCheckBalance` by full X but `bridgeAdjustment`
        // only by net (= X - fee), so the baseline only grows from bridge activity. Plus
        // yield accrual. Underflow would indicate corrupted state or wOToken depeg
        // beyond expected magnitudes.
        require(yieldOnly >= 0, "Remote: negative yield baseline");
        bytes memory ackPayload = CrossChainV3Helper
            .encodeBalanceCheckResponsePayload(
                uint256(yieldOnly),
                srcTimestamp
            );
        _sendYieldMessage(
            CrossChainV3Helper.BALANCE_CHECK_RESPONSE,
            nonce,
            ackPayload
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
        int256 yieldOnly = int256(_viewCheckBalance()) - bridgeAdjustment;
        require(yieldOnly >= 0, "Remote: negative yield baseline");
        bytes memory ackPayload = CrossChainV3Helper.encodeNewBalancePayload(
            uint256(yieldOnly)
        );
        _sendYieldMessage(
            CrossChainV3Helper.SETTLE_BRIDGE_ACCOUNTING_ACK,
            nonce,
            ackPayload
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
        uint256 amount = CrossChainV3Helper.decodeAmountPayload(payload);
        require(amount > 0, "Remote: zero withdraw");
        require(outstandingRequestId == 0, "Remote: queue already busy");

        // Unwrap wOToken → OToken to satisfy the queue request.
        uint256 sharesNeeded = IERC4626(woToken).previewWithdraw(amount);
        require(
            IERC20(woToken).balanceOf(address(this)) >= sharesNeeded,
            "Remote: insufficient shares"
        );
        IERC4626(woToken).withdraw(amount, address(this), address(this));

        // Queue the withdrawal on the OToken vault. Allowance pre-granted by
        // `safeApproveAllTokens`.
        (uint256 requestId, ) = IVault(oTokenVault).requestWithdrawal(amount);
        outstandingRequestId = requestId;
        queuedAmount = amount;
        outstandingRequestAmount = amount;

        // Reply to Master with the new total.
        uint256 newBalance = _viewCheckBalance();
        bytes memory ackPayload = CrossChainV3Helper.encodeNewBalancePayload(
            newBalance
        );
        _sendYieldMessage(
            CrossChainV3Helper.WITHDRAW_REQUEST_ACK,
            nonce,
            ackPayload
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

        // The originally-requested amount caps what leg-2 may ship — residual bridgeAsset
        // (donations, leftover from prior flows) stays on Remote rather than getting
        // attributed to this withdrawal. `outstandingRequestAmount` is refined to the
        // actually-claimed amount inside `_opportunisticClaim` if the queue paid out.
        uint256 target = outstandingRequestAmount;
        uint256 bridgeAssetHeld = IERC20(bridgeAsset).balanceOf(address(this));

        if (target == 0 || bridgeAssetHeld < target) {
            // Not ready (claim hasn't landed yet) or no outstanding request: NACK.
            uint256 currentBalance = _viewCheckBalance();
            bytes memory nackPayload = CrossChainV3Helper
                .encodeWithdrawClaimAckPayload(currentBalance, false, 0);
            _sendYieldMessage(
                CrossChainV3Helper.WITHDRAW_CLAIM_ACK,
                nonce,
                nackPayload
            );
            _acceptYieldNonce(nonce);
            emit WithdrawClaimNack(nonce, currentBalance);
            return;
        }

        uint256 amount = target;

        // Clear queue-side state (will be re-set if a fresh leg 1 starts) and bridge back.
        queuedAmount = 0;
        outstandingRequestId = 0;
        outstandingRequestAmount = 0;

        uint256 newBalance = _viewCheckBalance() - amount; // bridgeAsset about to leave us
        bytes memory ackPayload = CrossChainV3Helper
            .encodeWithdrawClaimAckPayload(newBalance, true, amount);
        // bridgeAsset → outboundAdapter allowance is granted by `setOutboundAdapter`.
        _sendYieldTokensAndMessage(
            bridgeAsset,
            amount,
            CrossChainV3Helper.WITHDRAW_CLAIM_ACK,
            nonce,
            ackPayload
        );
        _acceptYieldNonce(nonce);

        emit WithdrawClaimDelivered(nonce, amount, newBalance);
    }

    /**
     * @notice Permissionless, idempotent: claim the outstanding queue withdrawal if its delay
     *         has elapsed. Safe to call multiple times — early-returns when nothing's pending.
     */
    function claimRemoteWithdrawal() external nonReentrant {
        _opportunisticClaim();
    }

    function _opportunisticClaim() internal {
        uint256 id = outstandingRequestId;
        if (id == 0) {
            return;
        }
        // Use try/catch so a not-yet-claimable queue delay doesn't bubble up as a revert.
        // slither-disable-next-line uninitialized-local
        try IVault(oTokenVault).claimWithdrawal(id) returns (uint256 claimed) {
            outstandingRequestId = 0;
            queuedAmount = 0;
            // Refine `outstandingRequestAmount` to what the vault actually paid out so
            // leg-2 ships the precise claimed amount (accounts for any rounding gain/loss
            // between request time and claim time).
            outstandingRequestAmount = claimed;
            emit RemoteWithdrawalClaimed(id, claimed);
        } catch {
            // Still queued; leave state unchanged.
        }
    }

    function _processYieldDeposit(uint64 nonce, uint256 amount) internal {
        // bridgeAsset already arrived with the tokens-with-message delivery. Mint OToken
        // from the Ethereum vault, then wrap to wOToken.
        require(
            IERC20(bridgeAsset).balanceOf(address(this)) >= amount,
            "Remote: deposit asset missing"
        );

        // Mint OToken via the Ethereum-side vault. The real OUSD / OETH vault pulls
        // bridgeAsset via transferFrom inside `mint`; allowance pre-granted by
        // `safeApproveAllTokens`.
        IVault(oTokenVault).mint(amount);

        // Whatever OToken we now hold gets wrapped to wOToken (allowance pre-granted).
        uint256 oTokenBalance = IERC20(oToken).balanceOf(address(this));
        if (oTokenBalance > 0) {
            IERC4626(woToken).deposit(oTokenBalance, address(this));
        }

        // Reply to Master with the new balance and mark the yield nonce processed.
        uint256 newBalance = _viewCheckBalance();
        bytes memory ackPayload = CrossChainV3Helper.encodeNewBalancePayload(
            newBalance
        );
        _sendYieldMessage(CrossChainV3Helper.DEPOSIT_ACK, nonce, ackPayload);
        _acceptYieldNonce(nonce);

        emit YieldDepositProcessed(nonce, amount, newBalance);
    }

    // --- AbstractWOTokenStrategy hooks -------------------------------------

    /// @inheritdoc AbstractWOTokenStrategy
    function _bridgeOutboundMsgType() internal pure override returns (uint32) {
        return CrossChainV3Helper.BRIDGE_IN;
    }

    /// @inheritdoc AbstractWOTokenStrategy
    /// @dev Remote can always wrap user-supplied OToken; no liquidity check needed.
    function _preflightBridgeOutbound(uint256) internal view override {}

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
        // Value lives in exactly one slot at any time per the state-transition table:
        //   - shares  (4626 wrapped)
        //   - oToken  (unwrapped but not yet queued / redeemed)
        //   - bridgeAsset (claimed / redeemed but not yet bridged back)
        //   - queuedAmount (sitting in OToken-vault queue)
        uint256 sharesBalance = IERC20(woToken).balanceOf(address(this));
        uint256 valueOfShares = sharesBalance == 0
            ? 0
            : IERC4626(woToken).previewRedeem(sharesBalance);
        return
            valueOfShares +
            IERC20(oToken).balanceOf(address(this)) +
            IERC20(bridgeAsset).balanceOf(address(this)) +
            queuedAmount;
    }
}
