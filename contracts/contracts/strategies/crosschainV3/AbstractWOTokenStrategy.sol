// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20, SafeERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IBasicToken } from "../../interfaces/IBasicToken.sol";
import { StableMath } from "../../utils/StableMath.sol";

import { AbstractCrossChainV3Strategy } from "./AbstractCrossChainV3Strategy.sol";
import { CrossChainV3Helper } from "./CrossChainV3Helper.sol";

/**
 * @title AbstractWOTokenStrategy
 * @author Origin Protocol Inc
 *
 * @notice Shared base for the wOToken cross-chain strategy pair (Master on L2, Remote on
 *         Ethereum). Lifts everything that's duplicated between Master and Remote:
 *
 *           - Constants + immutables (bridgeAsset, oToken, MAX_BRIDGE_CALL_GAS).
 *           - Bridge-channel state (bridgeAdjustment, consumedBridgeIds, bridgeIdCounter).
 *           - Generic bridge-channel mechanics: outbound send (`bridgeOTokenToPeer`),
 *             inbound dispatch (`_handleInboundBridgeMessage`), replay protection, signed
 *             `bridgeAdjustment` bookkeeping, optional post-delivery callback.
 *           - `_abstractSetPToken` and `collectRewardTokens` no-op stubs (Strategy base
 *             requires them; neither strategy uses them).
 *           - `onlyOperatorGovernorOrStrategist` modifier (operator OR strategist OR governor).
 *
 *         Concrete strategies implement four hooks for the small middle of each bridge op
 *         that differs between the two sides:
 *
 *           - `_bridgeOutboundMsgType()` — Master: BRIDGE_OUT, Remote: BRIDGE_IN.
 *           - `availableBridgeLiquidity()` — Master: deliverable wOToken ceiling, Remote: unbounded.
 *           - `_consumeOTokenForBridge(amount)` — Master: burn via vault, Remote: wrap to wOToken.
 *           - `_deliverOTokenForBridge(amount, recipient)` — Master: mint+transfer, Remote: unwrap+transfer.
 */
abstract contract AbstractWOTokenStrategy is
    AbstractCrossChainV3Strategy,
    InitializableAbstractStrategy
{
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    // --- Constants & immutables --------------------------------------------

    /// @notice Maximum gas forwarded to the optional post-delivery `callData` call on
    ///         the bridge channel. Caps griefing surface; users can request lower per call.
    uint32 public constant MAX_BRIDGE_CALL_GAS = 500000;

    /// @notice Maximum protocol fee on the bridge channel (10% in basis points).
    uint256 public constant MAX_BRIDGE_FEE_BPS = 1000;

    /// @dev Basis-points denominator (100% = 10000) for the bridge-fee calc.
    uint256 internal constant BPS_DENOMINATOR = 10000;

    /// @notice Asset that bridges between Master and Remote (USDC for OUSD V3, WETH for OETHb).
    address public immutable bridgeAsset;

    /// @notice OToken on this chain (the rebasing OToken — OUSD, OETH, OETHb, etc.).
    address public immutable oToken;

    /// @notice Decimals of `bridgeAsset` (6 for USDC, 18 for WETH). Cached at construction.
    uint8 public immutable bridgeAssetDecimals;

    /// @notice Decimals of `oToken` (18 for OUSD / OETH). Cached at construction.
    uint8 public immutable oTokenDecimals;

    // --- Storage (all new slots) -------------------------------------------

    /// @notice Signed net delta from bridge-channel activity since the last settlement.
    ///         BRIDGE_IN (mint locally / wrap locally) → increases.
    ///         BRIDGE_OUT (burn locally / unwrap locally) → decreases.
    int256 public bridgeAdjustment;

    /// @notice Replay protection for the nonceless bridge channel.
    mapping(bytes32 => bool) public consumedBridgeIds;

    /// @notice Monotonic counter used to generate fresh bridgeIds for outbound BRIDGE_IN
    ///         / BRIDGE_OUT operations. NOT globally unique on its own — under CREATE3 parity
    ///         Master and Remote share `address(this)`, so the same counter yields the same id
    ///         on both. Replay safety instead comes from `consumedBridgeIds` being per-chain:
    ///         each side only ever consumes the PEER's ids (Master consumes Remote's BRIDGE_INs,
    ///         Remote consumes Master's BRIDGE_OUTs), and the peer's counter is monotonic.
    uint256 public bridgeIdCounter;

    /// @notice Protocol fee on the bridge channel in basis points (1 bp = 0.01%). Default
    ///         0; capped at `MAX_BRIDGE_FEE_BPS`. When > 0, the source side consumes the
    ///         full `_amount` of OToken while the envelope carries `net = _amount - fee`,
    ///         so the peer only delivers `net`. The retained `fee` worth of backing flows
    ///         through the next `BALANCE_CHECK` and lifts the vault's rebase by the
    ///         fee.
    uint256 public bridgeFeeBps;

    /// @dev Reserved for future expansion of this abstract layer.
    uint256[43] private __gap;

    // --- Events -------------------------------------------------------------

    event BridgeRequested(
        bytes32 indexed bridgeId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 fee,
        bytes callData,
        uint32 callGasLimit
    );
    event BridgeDelivered(
        bytes32 indexed bridgeId,
        address indexed recipient,
        uint256 amount
    );
    event BridgeFeeBpsUpdated(uint256 oldBps, uint256 newBps);
    event BridgeCallSucceeded(
        bytes32 indexed bridgeId,
        address indexed recipient,
        uint256 amount
    );
    event BridgeCallFailed(
        bytes32 indexed bridgeId,
        address indexed recipient,
        uint256 amount,
        bytes returnData
    );

    // --- Construction -------------------------------------------------------

    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _bridgeAsset,
        address _oToken
    ) InitializableAbstractStrategy(_stratConfig) {
        require(_bridgeAsset != address(0), "WOT: bridge asset required");
        require(_oToken != address(0), "WOT: oToken required");
        bridgeAsset = _bridgeAsset;
        oToken = _oToken;
        bridgeAssetDecimals = IBasicToken(_bridgeAsset).decimals();
        oTokenDecimals = IBasicToken(_oToken).decimals();
    }

    /// @dev Shared `initialize` body: no reward tokens, `[bridgeAsset]` as the supported
    ///      asset, and `[pToken]` as the platform token for the strategy registry. Master
    ///      passes `bridgeAsset` (it has no real platform); Remote passes `woToken`.
    function _initWithPToken(address pToken) internal {
        address[] memory rewardTokens = new address[](0);
        address[] memory assets = new address[](1);
        address[] memory pTokens = new address[](1);
        assets[0] = bridgeAsset;
        pTokens[0] = pToken;
        InitializableAbstractStrategy._initialize(
            rewardTokens,
            assets,
            pTokens
        );
    }

    // --- Modifiers ----------------------------------------------------------

    /// @notice Permits the operator, strategist, or governor.
    modifier onlyOperatorGovernorOrStrategist() {
        require(
            msg.sender == operator ||
                isGovernor() ||
                msg.sender == IVault(vaultAddress).strategistAddr(),
            "WOT: not authorised"
        );
        _;
    }

    // --- Strategy-base shims (no-op) ---------------------------------------

    /// @inheritdoc InitializableAbstractStrategy
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == bridgeAsset;
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

    /**
     * @inheritdoc AbstractCrossChainV3Strategy
     * @dev Rotates the bridgeAsset allowance from the old outbound adapter to the new one
     *      (old → 0, new → max) so the per-op send path never needs a per-call approve.
     *      Shared by Master and Remote — both only ever push bridgeAsset through the adapter.
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
        // slither-disable-next-line reentrancy-no-eth
        super._setOutboundAdapter(_outboundAdapter);
        if (_outboundAdapter != address(0) && old != _outboundAdapter) {
            IERC20(bridgeAsset).safeApprove(
                _outboundAdapter,
                type(uint256).max
            );
        }
    }

    // --- Decimal scaling ----------------------------------------------------
    //
    // The OToken domain (wOToken shares, OToken, `bridgeAdjustment`,
    // `remoteStrategyBalance`, the OToken bridge channel) is denominated in
    // `oTokenDecimals` (18). The vault / physical domain (deposit / withdraw amounts,
    // `pendingDepositAmount`, `pendingWithdrawalAmount`, physical bridge transfers, and
    // `checkBalance`'s return value) is denominated in `bridgeAssetDecimals`. These two
    // helpers convert between the domains; both are the identity when the decimals match
    // (e.g. WETH / OETH 18/18), so the matched-decimal deployment is unaffected.

    /// @dev bridgeAsset units → OToken units.
    function _toOToken(uint256 assetAmount) internal view returns (uint256) {
        return assetAmount.scaleBy(oTokenDecimals, bridgeAssetDecimals);
    }

    /// @dev OToken units → bridgeAsset units.
    function _toAsset(uint256 oTokenAmount) internal view returns (uint256) {
        return oTokenAmount.scaleBy(bridgeAssetDecimals, oTokenDecimals);
    }

    // --- Bridge channel: outbound -------------------------------------------

    /**
     * @notice User-initiated bridge: burn (Master) or wrap (Remote) `_amount` of OToken
     *         locally and instruct the peer chain to deliver the equivalent amount.
     * @param _amount        OToken amount to bridge.
     * @param _recipient     Destination on the peer chain. `address(0)` defaults to msg.sender.
     * @param _callData      Optional calldata invoked on `_recipient` after token delivery on
     *                       the destination side. Empty for plain bridge.
     * @param _callGasLimit  Per-call gas cap; must be ≤ MAX_BRIDGE_CALL_GAS.
     */
    function bridgeOTokenToPeer(
        uint256 _amount,
        address _recipient,
        bytes calldata _callData,
        uint32 _callGasLimit
    ) external payable nonReentrant {
        require(_amount > 0, "WOT: zero bridge");
        require(outboundAdapter != address(0), "WOT: outbound not set");
        require(
            _callGasLimit <= MAX_BRIDGE_CALL_GAS,
            "WOT: callGasLimit too high"
        );
        require(
            _callData.length == 0 || _callGasLimit > 0,
            "WOT: callData needs gas"
        );
        _bridgeOutboundExec(_amount, _recipient, _callData, _callGasLimit);
    }

    /// @dev Split from `bridgeOTokenToPeer` to keep the public function's stack within
    ///      limits — the burn-full/deliver-net + envelope build chain pushes several
    ///      locals that crowd the verifier.
    function _bridgeOutboundExec(
        uint256 _amount,
        address _recipient,
        bytes calldata _callData,
        uint32 _callGasLimit
    ) private {
        // Burn-full / deliver-net: protocol fee is consumed on the source (full `_amount`)
        // but only `net` flows across the bridge; the difference is the retained backing
        // that lifts the next rebase.
        uint256 fee = (_amount * bridgeFeeBps) / BPS_DENOMINATOR;
        uint256 net = _amount - fee;
        require(net > 0, "WOT: net zero after fee");

        // Liquidity gate against `net` (what the peer must produce). Quote the same value
        // off-chain via `availableBridgeLiquidity()` first to avoid a revert.
        require(
            net <= availableBridgeLiquidity(),
            "WOT: insufficient bridge liquidity"
        );

        address recipient = _recipient == address(0) ? msg.sender : _recipient;

        // Master burns FULL `_amount`; Remote wraps FULL `_amount`. The fee portion stays
        // as backing on the wOToken side and accrues to yield via the next BALANCE_CHECK.
        _consumeOTokenForBridge(_amount);

        uint32 msgType = _bridgeOutboundMsgType();
        // Accounting captures the obligation that's actually leaving — `net`.
        _applyBridgeAdjustment(msgType, net);

        bytes32 bridgeId = _nextBridgeId();
        bytes memory body = CrossChainV3Helper.encodeBridgeUserPayload(
            CrossChainV3Helper.BridgeUserPayload({
                bridgeId: bridgeId,
                amount: net,
                recipient: recipient,
                callData: _callData,
                callGasLimit: _callGasLimit
            })
        );
        _send(address(0), 0, msgType, 0, body, true);

        emit BridgeRequested(
            bridgeId,
            msg.sender,
            recipient,
            net,
            fee,
            _callData,
            _callGasLimit
        );
    }

    // --- Governance --------------------------------------------------------

    function setBridgeFeeBps(uint256 _bps) external onlyGovernor {
        require(_bps <= MAX_BRIDGE_FEE_BPS, "WOT: fee too high");
        emit BridgeFeeBpsUpdated(bridgeFeeBps, _bps);
        bridgeFeeBps = _bps;
    }

    // --- Bridge channel: inbound -------------------------------------------

    /**
     * @dev Called by concrete strategies from `_handleBridgeMessage` when an inbound
     *      BRIDGE_IN / BRIDGE_OUT envelope arrives. Replay-checked, applies signed
     *      `bridgeAdjustment`, invokes the side-specific delivery hook, runs the optional
     *      post-delivery callback.
     *
     *      `nonReentrant` (Governable's shared fixed-slot lock — the same one
     *      `bridgeOTokenToPeer` / `deposit` acquire) is held through `_postDeliveryCall`'s
     *      untrusted `recipient.call`, so the callback can't re-enter any state-mutating
     *      entrypoint. This is the only inbound path with an external callback.
     */
    function _handleInboundBridgeMessage(
        uint32 msgType,
        uint256 amount,
        bytes memory body
    ) internal nonReentrant {
        CrossChainV3Helper.BridgeUserPayload memory p = CrossChainV3Helper
            .decodeBridgeUserPayload(body);

        require(!consumedBridgeIds[p.bridgeId], "WOT: bridgeId replayed");
        // Bridge-channel messages are message-only by design; tokens never ride along.
        require(amount == 0, "WOT: bridge-in tokens not expected");
        require(
            p.callGasLimit <= MAX_BRIDGE_CALL_GAS,
            "WOT: callGasLimit too high"
        );

        // CEI: mark consumed, update accounting, deliver tokens, optional call.
        consumedBridgeIds[p.bridgeId] = true;
        _applyBridgeAdjustment(msgType, p.amount);

        // Side-specific delivery (Master: mint + transfer; Remote: unwrap + transfer).
        _deliverOTokenForBridge(p.amount, p.recipient);

        emit BridgeDelivered(p.bridgeId, p.recipient, p.amount);

        if (p.callData.length == 0) {
            return;
        }

        _postDeliveryCall(p);
    }

    /**
     * @dev Best-effort post-delivery call on the recipient. Never reverts; tokens have
     *      already been delivered before this runs. No msg.value forwarded; gas bounded
     *      by `p.callGasLimit` (already capped above by MAX_BRIDGE_CALL_GAS).
     */
    function _postDeliveryCall(CrossChainV3Helper.BridgeUserPayload memory p)
        private
    {
        // slither-disable-next-line low-level-calls,unchecked-lowlevel
        (bool ok, bytes memory ret) = p.recipient.call{
            value: 0,
            gas: p.callGasLimit
        }(p.callData);
        if (ok) {
            emit BridgeCallSucceeded(p.bridgeId, p.recipient, p.amount);
        } else {
            emit BridgeCallFailed(p.bridgeId, p.recipient, p.amount, ret);
        }
    }

    /**
     * @dev Apply the signed delta to `bridgeAdjustment` based on the message type. Both
     *      Master and Remote use the same convention: BRIDGE_IN increases (mint/wrap),
     *      BRIDGE_OUT decreases (burn/unwrap). The sign is determined by the message type
     *      alone — no per-side configuration needed.
     */
    function _applyBridgeAdjustment(uint32 msgType, uint256 amount) internal {
        if (msgType == CrossChainV3Helper.BRIDGE_IN) {
            bridgeAdjustment += int256(amount);
        } else {
            // BRIDGE_OUT (only other valid bridge-channel type; caller enforces this).
            bridgeAdjustment -= int256(amount);
        }
    }

    function _nextBridgeId() internal returns (bytes32) {
        bridgeIdCounter += 1;
        return keccak256(abi.encode(address(this), bridgeIdCounter));
    }

    // --- Hooks (concrete strategies implement) -----------------------------

    /// @notice Outbound bridge-channel message type. Master: BRIDGE_OUT, Remote: BRIDGE_IN.
    function _bridgeOutboundMsgType() internal pure virtual returns (uint32);

    /**
     * @notice Max OToken (18dp) amount currently bridgeable from this chain to the peer — what
     *         the peer can actually deliver right now. Quote against this before
     *         `bridgeOTokenToPeer` to avoid a revert. The per-side formula lives in each
     *         concrete override (Master: bounded by Remote's deliverable shares; Remote:
     *         unbounded — `type(uint256).max` — since bridging out wraps the user's own OToken).
     */
    function availableBridgeLiquidity() public view virtual returns (uint256);

    /**
     * @notice Pull OToken from `msg.sender` and consume it on this chain.
     *         Master: burn via the OToken vault. Remote: wrap to wOToken via the ERC-4626.
     */
    function _consumeOTokenForBridge(uint256 amount) internal virtual;

    /**
     * @notice Produce OToken on this chain and deliver it to `recipient`.
     *         Master: mint via the OToken vault, then transfer. Remote: unwrap wOToken to
     *         OToken, then transfer.
     */
    function _deliverOTokenForBridge(uint256 amount, address recipient)
        internal
        virtual;
}
