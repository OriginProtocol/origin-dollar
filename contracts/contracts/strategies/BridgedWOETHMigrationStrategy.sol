// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

import { BridgedWOETHStrategy } from "./BridgedWOETHStrategy.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IVault } from "../interfaces/IVault.sol";
import { NativeFeeHelper } from "./crosschainV3/libraries/NativeFeeHelper.sol";
import { CCIPMessageBuilder } from "./crosschainV3/libraries/CCIPMessageBuilder.sol";

/**
 * @title BridgedWOETHMigrationStrategy
 * @author Origin Protocol Inc
 *
 * @notice One-shot migration impl that upgrades the existing BridgedWOETHStrategy proxy on
 *         Base. Adds the ability to ship wOETH to the V3 Master/Remote pair via CCIP, while
 *         retaining V1's local deposit/withdraw + oracle pipeline (inherited unchanged).
 *
 *         Storage carries forward V1's two existing fields (lastOraclePrice, maxPriceDiffBps)
 *         and appends three new ones (totalBridged, maxPerBridge, operator) plus an upgrade
 *         gap. All cross-chain configuration that doesn't change between deploys lives in
 *         immutables: `master` is both the local Master strategy on Base (read for
 *         in-flight reconciliation) and the cross-chain CCIP recipient on Ethereum (same
 *         address by CreateX-driven parity).
 *
 *         Access pattern:
 *           - `bridgeToRemote` callable by operator, governor, or strategist.
 *           - `setMaxPerBridge` callable by governor or strategist.
 *           - `setOperator` callable by governor only.
 *           - V1's `setMaxPriceDiffBps` (governor-only) and depositBridgedWOETH /
 *             withdrawBridgedWOETH (governor or strategist) are inherited unchanged.
 */
contract BridgedWOETHMigrationStrategy is BridgedWOETHStrategy {
    using SafeERC20 for IERC20;

    // --- Immutables -------------------------------------------------------

    /// @notice Local Master strategy address on Base. Same address on Ethereum (CreateX
    ///         parity) points at the Remote strategy — used as the CCIP recipient.
    address public immutable master;

    /// @notice Chainlink CCIP Router on this chain (Base).
    IRouterClient public immutable ccipRouter;

    /// @notice CCIP chain selector for Ethereum mainnet.
    uint64 public immutable ccipChainSelectorMainnet;

    // --- Storage (appended after V1's existing fields) --------------------

    /// @notice Cumulative wOETH bridged out to the V3 Remote on Ethereum. Used to compute
    ///         the in-flight component of `checkBalance` until Master reports it.
    uint256 public totalBridged;

    /// @notice Per-call cap on `bridgeToRemote`, configurable by governor or strategist.
    uint256 public maxPerBridge;

    /// @notice Automation EOA permitted to drive `bridgeToRemote` calls.
    address public operator;

    uint256[47] private __gap;

    // --- Events -----------------------------------------------------------

    event MaxPerBridgeSet(uint256 maxPerBridge);
    event OperatorUpdated(address oldOperator, address newOperator);
    event WOETHBridgedToRemote(uint256 amount, uint256 totalBridged);

    // --- Errors -----------------------------------------------------------

    // (none — using require strings for parity with the rest of the codebase)

    // --- Constructor ------------------------------------------------------

    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _weth,
        address _bridgedWOETH,
        address _oethb,
        address _oracle,
        address _master,
        address _ccipRouter,
        uint64 _ccipChainSelectorMainnet
    )
        BridgedWOETHStrategy(
            _stratConfig,
            _weth,
            _bridgedWOETH,
            _oethb,
            _oracle
        )
    {
        require(_master != address(0), "BWM: zero master");
        require(_ccipRouter != address(0), "BWM: zero router");
        master = _master;
        ccipRouter = IRouterClient(_ccipRouter);
        ccipChainSelectorMainnet = _ccipChainSelectorMainnet;
    }

    // --- Access control ---------------------------------------------------

    modifier onlyOperatorGovernorOrStrategist() {
        require(
            msg.sender == operator ||
                isGovernor() ||
                msg.sender == IVault(vaultAddress).strategistAddr(),
            "BWM: not authorised"
        );
        _;
    }

    // --- Operator / cap configuration ------------------------------------

    function setOperator(address _operator) external onlyGovernor {
        emit OperatorUpdated(operator, _operator);
        operator = _operator;
    }

    function setMaxPerBridge(uint256 _maxPerBridge)
        external
        onlyGovernorOrStrategist
    {
        _setMaxPerBridge(_maxPerBridge);
    }

    function _setMaxPerBridge(uint256 _maxPerBridge) internal {
        require(_maxPerBridge > 0, "BWM: zero max");
        maxPerBridge = _maxPerBridge;
        emit MaxPerBridgeSet(_maxPerBridge);
    }

    // --- Bridge to Remote -------------------------------------------------

    /**
     * @notice Ship `_amount` of wOETH to the Remote strategy on Ethereum via CCIP. The fee
     *         is paid in native (either pre-funded on this contract or supplied as
     *         `msg.value`; any surplus refunds to the caller).
     *
     *         CCIP is invoked with `extraArgs.gasLimit = 0`, which CCIP interprets as
     *         "token transfer only, no destination callback". The Remote strategy on
     *         Ethereum receives the wOETH balance directly; no `ccipReceive` runs.
     */
    function bridgeToRemote(uint256 _amount)
        external
        payable
        onlyOperatorGovernorOrStrategist
        nonReentrant
    {
        require(_amount > 0 && _amount <= maxPerBridge, "BWM: bad amount");
        require(
            bridgedWOETH.balanceOf(address(this)) >= _amount,
            "BWM: insufficient wOETH"
        );

        // Same shape (single token amount, native fee, V1 extraArgs) the V3 CCIPAdapter
        // builds — `require(_amount > 0)` above guarantees the token-amount branch.
        // The CCIP recipient `master` is the peer strategy on Ethereum (the V3 Remote, which
        // custodies the wOETH); Master and Remote share an address via CreateX/CREATE2 deployment.
        Client.EVM2AnyMessage memory ccipMessage = CCIPMessageBuilder.build(
            address(bridgedWOETH),
            _amount,
            "",
            master,
            0
        );

        uint256 fee = ccipRouter.getFee(ccipChainSelectorMainnet, ccipMessage);
        NativeFeeHelper.consume(fee);

        IERC20(address(bridgedWOETH)).safeApprove(address(ccipRouter), _amount);
        ccipRouter.ccipSend{ value: fee }(
            ccipChainSelectorMainnet,
            ccipMessage
        );

        totalBridged += _amount;
        emit WOETHBridgedToRemote(_amount, totalBridged);
    }

    receive() external payable {}

    // --- checkBalance override (WETH-only accounting) --------------------

    /**
     * @notice Returns the strategy's contribution to the OETHb vault in WETH terms.
     * @dev Stays entirely in WETH on this side (the V2 design converted Master's WETH to
     *      wOETH using a stale stored price, which over-counted in-flight whenever Master
     *      reported value before our oracle ticked). New design:
     *        - `localValueWETH = bridgedWOETH.balanceOf(self) * lastOraclePrice / 1e18`
     *        - `bridgedValueWETH = totalBridged * lastOraclePrice / 1e18`
     *        - in-flight = max(0, bridgedValueWETH - master.checkBalance(weth))
     *      Once Master has reported at least the bridged-out value, the in-flight component
     *      collapses to zero — no negative subtraction needed.
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256)
    {
        require(_asset == address(weth), "BWM: unsupported asset");
        if (lastOraclePrice == 0) return 0;

        uint256 localValueWETH = (bridgedWOETH.balanceOf(address(this)) *
            lastOraclePrice) / 1 ether;

        if (totalBridged == 0) {
            return localValueWETH;
        }

        uint256 bridgedValueWETH = (totalBridged * lastOraclePrice) / 1 ether;
        uint256 masterValueWETH = IStrategy(master).checkBalance(address(weth));

        uint256 inFlight = masterValueWETH >= bridgedValueWETH
            ? 0
            : bridgedValueWETH - masterValueWETH;

        return localValueWETH + inFlight;
    }
}
