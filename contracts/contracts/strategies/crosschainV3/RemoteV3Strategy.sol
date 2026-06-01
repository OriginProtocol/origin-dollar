// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20, SafeERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IERC4626 } from "../../../lib/openzeppelin/interfaces/IERC4626.sol";
import { IVault } from "../../interfaces/IVault.sol";

import { AbstractCrossChainV3Strategy } from "./AbstractCrossChainV3Strategy.sol";
import { CrossChainV3Helper } from "./CrossChainV3Helper.sol";

/**
 * @title RemoteV3Strategy
 * @author Origin Protocol Inc
 *
 * @notice Ethereum-side leg of the OUSD V3 cross-chain strategy pair. Holds wOToken shares on
 *         behalf of the L2 vault. Runs the 2-step pipeline:
 *
 *           inbound : bridgeAsset → OToken (via OToken vault `mint`) → wOToken (via 4626.deposit)
 *           outbound: wOToken (via 4626.withdraw) → OToken → bridgeAsset (via OToken vault redeem)
 *
 *         Remote is NOT registered with any vault — it's a custodian for shares held on behalf
 *         of the L2 Master. The `oTokenVault` parameter points at the Ethereum-side OToken vault
 *         (e.g. the mainnet OUSD vault or the mainnet OETH vault). For PR 3 the path is the
 *         simple instant-redeem one (OUSD-style); the OETH async-queue Option-1 flow lands in
 *         PR 4 alongside the withdrawal message dispatch.
 *
 *         Remote intentionally does NOT extend `Generalized4626Strategy`. The 2-step pipeline
 *         has a unit mismatch between `bridgeAsset` (what Master sees) and the 4626's underlying
 *         asset (OToken). Overriding the base's deposit/withdraw/checkBalance would eat all the
 *         reuse — inline 4626 + OToken-vault calls are cleaner.
 *
 *         For the full Remote state-transition table (Idle → Requested → Claimed → Bridging-out
 *         → Completed) see the V3 implementation plan.
 */
contract RemoteV3Strategy is
    AbstractCrossChainV3Strategy,
    InitializableAbstractStrategy
{
    using SafeERC20 for IERC20;

    // --- Constants & immutables --------------------------------------------

    uint32 public constant MAX_BRIDGE_CALL_GAS = 500_000;

    /// @notice Asset that bridges between Master and Remote (USDC for OUSD V3, WETH for OETHb).
    address public immutable bridgeAsset;

    /// @notice Ethereum-side OToken (OUSD or OETH).
    address public immutable oToken;

    /// @notice ERC-4626 wrapper of the OToken (wOUSD or wOETH).
    address public immutable woToken;

    /// @notice Ethereum-side OToken vault. Used to convert bridgeAsset ↔ OToken via mint / redeem.
    address public immutable oTokenVault;

    // --- Storage (all new slots; nothing from any parent is relocated) -----

    /// @notice Signed net bridge-channel delta in bridgeAsset units since last settlement.
    ///         BRIDGE_IN (user gave OToken on Ethereum, wrapped here) → increases.
    ///         BRIDGE_OUT (Master burned, Remote unwraps here) → decreases.
    int256 public bridgeAdjustment;

    /// @notice OToken-vault queue handle. 0 = no outstanding queue request.
    ///         (Used by the Option-1 withdrawal path landing in PR 4.)
    uint256 public outstandingRequestId;

    /// @notice BridgeAsset value sitting in the OToken vault queue, not yet claimed.
    ///         Set when `requestWithdrawal` runs, cleared when `claimWithdrawal` succeeds.
    ///         (Used by the Option-1 withdrawal path landing in PR 4.)
    uint256 public queuedAmount;

    /// @notice Originally-requested bridgeAsset amount for the outstanding withdrawal.
    ///         Set in `_processWithdrawRequest`, refined to the actually-claimed amount
    ///         once `_opportunisticClaim` succeeds, cleared on successful leg-2 delivery.
    ///         Caps the value leg-2 may ship to Master, defeating residual/donation over-send.
    uint256 public outstandingRequestAmount;

    /// @notice Replay protection for the nonceless bridge channel.
    mapping(bytes32 => bool) public consumedBridgeIds;

    /// @notice Monotonic counter used to produce unique bridgeIds for outbound BRIDGE_IN ops.
    uint256 public bridgeIdCounter;

    /// @dev Reserved for future expansion.
    uint256[39] private __gap;

    // --- Events -------------------------------------------------------------

    event YieldDepositProcessed(
        uint64 nonce,
        uint256 amount,
        uint256 newBalance
    );
    event BridgeInRequested(
        bytes32 indexed bridgeId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        bytes callData,
        uint32 callGasLimit
    );
    event BridgeOutDelivered(
        bytes32 indexed bridgeId,
        address indexed recipient,
        uint256 amount
    );
    event BridgeOutDeliveredWithCall(
        bytes32 indexed bridgeId,
        address indexed recipient,
        uint256 amount
    );
    event BridgeOutCallFailed(
        bytes32 indexed bridgeId,
        address indexed recipient,
        uint256 amount,
        bytes returnData
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
    ) InitializableAbstractStrategy(_stratConfig) {
        // Remote has no L2 vault and uses `woToken` as its "platform" for the strategy registry.
        require(
            _stratConfig.vaultAddress == address(0),
            "Remote: vault must be zero"
        );
        require(_bridgeAsset != address(0), "Remote: bridge asset required");
        require(_oToken != address(0), "Remote: oToken required");
        require(_woToken != address(0), "Remote: woToken required");
        require(_oTokenVault != address(0), "Remote: oTokenVault required");
        require(
            _stratConfig.platformAddress == _woToken,
            "Remote: platform must be woToken"
        );
        bridgeAsset = _bridgeAsset;
        oToken = _oToken;
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
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == bridgeAsset;
    }

    /// @inheritdoc InitializableAbstractStrategy
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256)
    {
        require(_asset == bridgeAsset, "Remote: unsupported asset");
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

    /// @inheritdoc InitializableAbstractStrategy
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        // bridgeAsset → oTokenVault, oToken → woToken. Done as type(uint256).max once.
        IERC20(bridgeAsset).safeApprove(oTokenVault, type(uint256).max);
        IERC20(oToken).safeApprove(woToken, type(uint256).max);
    }

    /// @inheritdoc InitializableAbstractStrategy
    function _abstractSetPToken(address, address) internal override {}

    /// @inheritdoc InitializableAbstractStrategy
    function collectRewardTokens()
        external
        override
        onlyHarvesterOrStrategist
        nonReentrant
    {}

    /// @inheritdoc InitializableAbstractStrategy
    function deposit(address, uint256)
        external
        view
        override
        onlyVaultOrGovernor
    {
        // Remote is not registered with any vault; deposits arrive via the bridge.
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

    // --- Bridge channel: user-facing bridge-in (Ethereum → L2) -------------

    /**
     * @notice User-initiated bridge-in: user pays OToken on Ethereum, Remote wraps it and tells
     *         Master to mint the equivalent amount of OToken on the L2 (optionally invoking
     *         `_callData` on `_recipient` post-delivery).
     */
    function bridgeOTokenToPeer(
        uint256 _amount,
        address _recipient,
        bytes calldata _callData,
        uint32 _callGasLimit
    ) external payable nonReentrant {
        require(_amount > 0, "Remote: zero bridge");
        require(outboundAdapter != address(0), "Remote: outbound not set");
        require(
            _callGasLimit <= MAX_BRIDGE_CALL_GAS,
            "Remote: callGasLimit too high"
        );
        require(
            _callData.length == 0 || _callGasLimit > 0,
            "Remote: callData needs gas"
        );

        address recipient = _recipient == address(0) ? msg.sender : _recipient;

        // Pull OToken from user and wrap into wOToken shares held by this strategy.
        IERC20(oToken).safeTransferFrom(msg.sender, address(this), _amount);
        _ensureApproval(oToken, woToken, _amount);
        IERC4626(woToken).deposit(_amount, address(this));

        // Bridge-in (from Ethereum's perspective): unsettled OToken pool grew by `_amount`.
        bridgeAdjustment += int256(_amount);

        bytes32 bridgeId = _nextBridgeId();
        CrossChainV3Helper.BridgeUserPayload memory p = CrossChainV3Helper
            .BridgeUserPayload({
                bridgeId: bridgeId,
                amount: _amount,
                recipient: recipient,
                callData: _callData,
                callGasLimit: _callGasLimit
            });

        bytes memory message = CrossChainV3Helper.wrap(
            CrossChainV3Helper.BRIDGE_IN,
            0,
            CrossChainV3Helper.encodeBridgeUserPayload(p)
        );

        _sendMessage(message);

        emit BridgeInRequested(
            bridgeId,
            msg.sender,
            recipient,
            _amount,
            _callData,
            _callGasLimit
        );
    }

    function _nextBridgeId() internal returns (bytes32) {
        bridgeIdCounter += 1;
        return keccak256(abi.encode(address(this), bridgeIdCounter));
    }

    // --- Inbound dispatch --------------------------------------------------

    function _handleBridgeMessage(
        uint64 nonce,
        uint256 amount,
        uint8 messageType,
        bytes calldata payload
    ) internal override {
        if (messageType == CrossChainV3Helper.YIELD_DEPOSIT) {
            _processYieldDeposit(nonce, amount);
        } else if (messageType == CrossChainV3Helper.WITHDRAW_REQUEST) {
            _processWithdrawRequest(nonce, payload);
        } else if (messageType == CrossChainV3Helper.WITHDRAW_CLAIM) {
            _processWithdrawClaim(nonce);
        } else if (messageType == CrossChainV3Helper.BRIDGE_OUT) {
            _processBridgeOut(payload);
        } else if (messageType == CrossChainV3Helper.BALANCE_CHECK_REQUEST) {
            _processBalanceCheckRequest(nonce, payload);
        } else if (messageType == CrossChainV3Helper.SETTLE_BRIDGE) {
            _processSettlement(nonce);
        } else {
            revert("Remote: unsupported message type");
        }
    }

    function _processBalanceCheckRequest(uint64 nonce, bytes calldata payload)
        internal
    {
        uint256 srcTimestamp = CrossChainV3Helper
            .decodeBalanceCheckRequestPayload(payload);
        uint256 newBalance = _viewCheckBalance();
        bytes memory ackPayload = CrossChainV3Helper
            .encodeBalanceCheckResponsePayload(newBalance, srcTimestamp);
        bytes memory message = CrossChainV3Helper.wrap(
            CrossChainV3Helper.BALANCE_CHECK_RESPONSE,
            nonce,
            ackPayload
        );
        _sendMessage(message);
        _acceptYieldNonce(nonce);
    }

    function _processSettlement(uint64 nonce) internal {
        // Clear Remote's unsettled delta. The new authoritative balance is reported in
        // the ack via `_viewCheckBalance` (which now reflects all bridge-channel activity
        // through `previewRedeem`).
        bridgeAdjustment = 0;
        uint256 newBalance = _viewCheckBalance();
        bytes memory ackPayload = CrossChainV3Helper.encodeNewBalancePayload(
            newBalance
        );
        bytes memory message = CrossChainV3Helper.wrap(
            CrossChainV3Helper.SETTLE_BRIDGE_ACK,
            nonce,
            ackPayload
        );
        _sendMessage(message);
        _acceptYieldNonce(nonce);
    }

    /**
     * @dev Leg 1 of Option 1. Unwrap wOToken → OToken, request a withdrawal from the
     *      Ethereum OToken vault queue, reply to Master with the new view of `checkBalance`.
     *      Master doesn't need the `requestId` (Remote owns the queue lifecycle).
     */
    function _processWithdrawRequest(uint64 nonce, bytes calldata payload)
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

        // Approve OToken to the vault and queue the withdrawal.
        _ensureApproval(oToken, oTokenVault, amount);
        (uint256 requestId, ) = IVault(oTokenVault).requestWithdrawal(amount);
        outstandingRequestId = requestId;
        queuedAmount = amount;
        outstandingRequestAmount = amount;

        // Reply to Master with the new total.
        uint256 newBalance = _viewCheckBalance();
        bytes memory ackPayload = CrossChainV3Helper.encodeNewBalancePayload(
            newBalance
        );
        bytes memory message = CrossChainV3Helper.wrap(
            CrossChainV3Helper.WITHDRAW_REQUEST_ACK,
            nonce,
            ackPayload
        );
        _sendMessage(message);
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
            bytes memory nackMessage = CrossChainV3Helper.wrap(
                CrossChainV3Helper.WITHDRAW_CLAIM_ACK,
                nonce,
                nackPayload
            );
            _sendMessage(nackMessage);
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
        bytes memory message = CrossChainV3Helper.wrap(
            CrossChainV3Helper.WITHDRAW_CLAIM_ACK,
            nonce,
            ackPayload
        );
        _ensureApproval(bridgeAsset, outboundAdapter, amount);
        _sendTokensAndMessage(bridgeAsset, amount, message);
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

        // Mint OToken via the Ethereum-side vault. The real OUSD / OETH vault
        // pulls bridgeAsset via transferFrom inside `mint`, so we approve first.
        _ensureApproval(bridgeAsset, oTokenVault, amount);
        IVault(oTokenVault).mint(amount);

        // Whatever OToken we now hold gets wrapped to wOToken.
        uint256 oTokenBalance = IERC20(oToken).balanceOf(address(this));
        if (oTokenBalance > 0) {
            _ensureApproval(oToken, woToken, oTokenBalance);
            IERC4626(woToken).deposit(oTokenBalance, address(this));
        }

        // Reply to Master with the new balance and mark the yield nonce processed.
        uint256 newBalance = _viewCheckBalance();
        bytes memory ackPayload = CrossChainV3Helper.encodeNewBalancePayload(
            newBalance
        );
        bytes memory message = CrossChainV3Helper.wrap(
            CrossChainV3Helper.YIELD_DEPOSIT_ACK,
            nonce,
            ackPayload
        );
        _sendMessage(message);
        _acceptYieldNonce(nonce);

        emit YieldDepositProcessed(nonce, amount, newBalance);
    }

    function _processBridgeOut(bytes calldata payload) internal {
        CrossChainV3Helper.BridgeUserPayload memory p = CrossChainV3Helper
            .decodeBridgeUserPayload(payload);

        require(!consumedBridgeIds[p.bridgeId], "Remote: bridgeId replayed");
        require(
            p.callGasLimit <= MAX_BRIDGE_CALL_GAS,
            "Remote: callGasLimit too high"
        );

        // CEI ordering: mark consumed, unwrap, transfer to recipient, then optional call.
        consumedBridgeIds[p.bridgeId] = true;
        bridgeAdjustment -= int256(p.amount);

        // Defensive: ensure we actually hold enough OToken value to satisfy this bridge-out.
        uint256 sharesNeeded = IERC4626(woToken).previewWithdraw(p.amount);
        require(
            IERC20(woToken).balanceOf(address(this)) >= sharesNeeded,
            "Remote: insufficient remote wOToken"
        );

        IERC4626(woToken).withdraw(p.amount, address(this), address(this));
        IERC20(oToken).safeTransfer(p.recipient, p.amount);

        emit BridgeOutDelivered(p.bridgeId, p.recipient, p.amount);

        if (p.callData.length == 0) {
            return;
        }

        // Tokens already delivered. Best-effort call, never reverts the message handling.
        // slither-disable-next-line low-level-calls,unchecked-lowlevel
        (bool ok, bytes memory ret) = p.recipient.call{
            value: 0,
            gas: p.callGasLimit
        }(p.callData);
        if (ok) {
            emit BridgeOutDeliveredWithCall(p.bridgeId, p.recipient, p.amount);
        } else {
            emit BridgeOutCallFailed(p.bridgeId, p.recipient, p.amount, ret);
        }
    }

    // --- Helpers -----------------------------------------------------------

    function _viewCheckBalance() internal view returns (uint256) {
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

    /**
     * @dev safeApprove requires the existing allowance to be 0 when raising it. The shared
     *      pattern in this codebase is to reset then set. Cheap helper to keep the call sites
     *      tidy.
     */
    function _ensureApproval(
        address token,
        address spender,
        uint256 amount
    ) internal {
        uint256 cur = IERC20(token).allowance(address(this), spender);
        if (cur < amount) {
            if (cur > 0) {
                IERC20(token).safeApprove(spender, 0);
            }
            IERC20(token).safeApprove(spender, type(uint256).max);
        }
    }
}
