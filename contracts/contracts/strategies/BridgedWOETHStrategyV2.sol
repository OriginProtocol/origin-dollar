// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20, SafeERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IRouterClient } from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

/**
 * @title BridgedWOETHStrategyV2
 * @author Origin Protocol Inc
 *
 * @notice Upgraded implementation of the existing `BridgedWOETHStrategyProxy` on Base. Powers
 *         the OETHb Phase 1 wOETH migration: provides the rate-limited `bridgeToRemote()` that
 *         CCIP-sends wOETH from this strategy on Base to the new V3 Remote on Ethereum, and a
 *         transitional `checkBalance` that keeps `oldStrategy.checkBalance + master.checkBalance`
 *         constant across the migration window (the "in-transit tracking" invariant from the
 *         OETHb Phase 1 proposal).
 *
 * Storage layout — IMPORTANT
 * --------------------------
 *         All V1 storage variables stay at the same slot offsets (`lastOraclePrice` (uint128) +
 *         `maxPriceDiffBps` (uint128) packed in one slot). New fields are appended.
 */
contract BridgedWOETHStrategyV2 is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeCast for uint256;
    using SafeERC20 for IERC20;

    // --- V1 immutables (unchanged) ----------------------------------------

    IWETH9 public immutable weth;
    IERC20 public immutable bridgedWOETH;
    IERC20 public immutable oethb;
    IOracle public immutable oracle;

    // --- V1 storage (do not reorder) --------------------------------------

    uint128 public lastOraclePrice;
    uint128 public maxPriceDiffBps;

    // --- V2 storage (append-only) -----------------------------------------

    /// @notice New Master strategy on Base whose `checkBalance` we subtract to compute
    ///         in-transit balance during the migration.
    address public master;

    /// @notice Cumulative wOETH amount that has been initiated for bridging to the Remote.
    uint256 public totalBridged;

    /// @notice CCIP chain selector for Ethereum (where the V3 Remote lives).
    uint64 public ccipChainSelectorMainnet;

    /// @notice CCIP router on Base.
    IRouterClient public ccipRouter;

    /// @notice Recipient of bridged wOETH on Ethereum (the V3 Remote).
    address public bridgeRecipient;

    /// @notice Per-call bridge cap to respect CCIP rate-limits. 1000 wOETH default.
    uint256 public maxPerBridge;

    uint256[44] private __gap;

    // --- Events -----------------------------------------------------------

    event MaxPriceDiffBpsUpdated(uint128 oldValue, uint128 newValue);
    event WOETHPriceUpdated(uint128 oldValue, uint128 newValue);
    event MasterSet(address indexed master);
    event CCIPConfigSet(
        address router,
        uint64 chainSelectorMainnet,
        address recipient
    );
    event MaxPerBridgeSet(uint256 maxPerBridge);
    event WOETHBridgedToRemote(uint256 amount, uint256 totalBridged);

    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _weth,
        address _bridgedWOETH,
        address _oethb,
        address _oracle
    ) InitializableAbstractStrategy(_stratConfig) {
        weth = IWETH9(_weth);
        bridgedWOETH = IERC20(_bridgedWOETH);
        oethb = IERC20(_oethb);
        oracle = IOracle(_oracle);
    }

    /// @notice V2 initialiser. Safe to call on a fresh proxy, but the production path is to
    ///         upgrade the existing proxy and never call this initializer (V1 state already
    ///         populated). The values can be set post-upgrade via the explicit setters.
    function initializeV2(
        address _master,
        IRouterClient _ccipRouter,
        uint64 _chainSelectorMainnet,
        address _bridgeRecipient,
        uint256 _maxPerBridge
    ) external onlyGovernor {
        // No `initializer` modifier — this is a re-entrant migration setter usable post-upgrade.
        _setMaster(_master);
        _setCCIPConfig(_ccipRouter, _chainSelectorMainnet, _bridgeRecipient);
        _setMaxPerBridge(_maxPerBridge);
    }

    // --- Configuration setters (governor) ---------------------------------

    function setMaster(address _master) external onlyGovernor {
        _setMaster(_master);
    }

    function setCCIPConfig(
        IRouterClient _ccipRouter,
        uint64 _chainSelectorMainnet,
        address _bridgeRecipient
    ) external onlyGovernor {
        _setCCIPConfig(_ccipRouter, _chainSelectorMainnet, _bridgeRecipient);
    }

    function setMaxPerBridge(uint256 _maxPerBridge) external onlyGovernor {
        _setMaxPerBridge(_maxPerBridge);
    }

    function setMaxPriceDiffBps(uint128 _bps) external onlyGovernor {
        _setMaxPriceDiffBps(_bps);
    }

    function _setMaster(address _master) internal {
        master = _master;
        emit MasterSet(_master);
    }

    function _setCCIPConfig(
        IRouterClient _ccipRouter,
        uint64 _chainSelectorMainnet,
        address _bridgeRecipient
    ) internal {
        ccipRouter = _ccipRouter;
        ccipChainSelectorMainnet = _chainSelectorMainnet;
        bridgeRecipient = _bridgeRecipient;
        emit CCIPConfigSet(
            address(_ccipRouter),
            _chainSelectorMainnet,
            _bridgeRecipient
        );
    }

    function _setMaxPerBridge(uint256 _maxPerBridge) internal {
        require(_maxPerBridge > 0, "BWV2: zero max");
        maxPerBridge = _maxPerBridge;
        emit MaxPerBridgeSet(_maxPerBridge);
    }

    function _setMaxPriceDiffBps(uint128 _bps) internal {
        require(_bps > 0 && _bps <= 10000, "Invalid bps value");
        emit MaxPriceDiffBpsUpdated(maxPriceDiffBps, _bps);
        maxPriceDiffBps = _bps;
    }

    // --- Oracle (unchanged) -----------------------------------------------

    function updateWOETHOraclePrice() external nonReentrant returns (uint256) {
        return _updateWOETHOraclePrice();
    }

    function _updateWOETHOraclePrice() internal returns (uint256) {
        uint256 oraclePrice = oracle.price(address(bridgedWOETH));
        require(oraclePrice > 1 ether, "Invalid wOETH value");
        uint128 oraclePrice128 = oraclePrice.toUint128();
        if (lastOraclePrice > 0) {
            require(oraclePrice128 >= lastOraclePrice, "Negative wOETH yield");
            uint256 maxPrice = (lastOraclePrice * (1e4 + maxPriceDiffBps)) /
                1e4;
            require(oraclePrice128 <= maxPrice, "Price diff beyond threshold");
        }
        emit WOETHPriceUpdated(lastOraclePrice, oraclePrice128);
        lastOraclePrice = oraclePrice128;
        return oraclePrice;
    }

    function getBridgedWOETHValue(uint256 woethAmount)
        public
        view
        returns (uint256)
    {
        return (woethAmount * lastOraclePrice) / 1 ether;
    }

    // --- Bridge to Remote (Phase 1) ---------------------------------------

    /**
     * @notice Bridge up to `maxPerBridge` wOETH to the new V3 Remote on Ethereum via CCIP.
     *         Strategist-callable; pays the CCIP fee from this contract's native balance.
     */
    function bridgeToRemote(uint256 _amount)
        external
        payable
        onlyGovernorOrStrategist
        nonReentrant
    {
        require(master != address(0), "BWV2: master not set");
        require(address(ccipRouter) != address(0), "BWV2: CCIP not set");
        require(bridgeRecipient != address(0), "BWV2: recipient not set");
        require(_amount > 0 && _amount <= maxPerBridge, "BWV2: bad amount");
        require(
            bridgedWOETH.balanceOf(address(this)) >= _amount,
            "BWV2: insufficient balance"
        );

        // Build CCIP message: wOETH token-only, no data, to the V3 Remote address.
        Client.EVMTokenAmount[] memory ta = new Client.EVMTokenAmount[](1);
        ta[0] = Client.EVMTokenAmount({
            token: address(bridgedWOETH),
            amount: _amount
        });
        Client.EVM2AnyMessage memory ccipMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(bridgeRecipient),
            data: "",
            tokenAmounts: ta,
            feeToken: address(0),
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({ gasLimit: 0 })
            )
        });

        uint256 fee = ccipRouter.getFee(ccipChainSelectorMainnet, ccipMessage);
        require(address(this).balance >= fee, "BWV2: insufficient native");

        IERC20(address(bridgedWOETH)).safeApprove(address(ccipRouter), _amount);
        ccipRouter.ccipSend{ value: fee }(
            ccipChainSelectorMainnet,
            ccipMessage
        );

        totalBridged += _amount;
        emit WOETHBridgedToRemote(_amount, totalBridged);
    }

    /**
     * @dev Receive native to fund CCIP fees.
     */
    receive() external payable {}

    // --- checkBalance with in-transit invariant ---------------------------

    /**
     * @notice Strategy balance in WETH units.
     *
     * During migration:
     *   - `local`     : wOETH still on this strategy on Base
     *   - `inTransit` : wOETH bridged but not yet reported by Master (totalBridged − masterBalance)
     *   - Master      : separately reports the rest via its own `checkBalance`
     *
     * Invariant across all migration states:
     *   thisStrategy.checkBalance(weth) + master.checkBalance(weth) == initial wOETH value
     *
     * Unit conversion note:
     *   Master reports its balance in WETH (the bridgeAsset); `totalBridged` is in wOETH
     *   tokens. To compute `inTransit` we convert Master's WETH back to wOETH at
     *   `lastOraclePrice`, subtract, then convert the local + in-transit total back to WETH
     *   at the same `lastOraclePrice`. The two oracle reads use the same snapshot, so the
     *   round-trip is exact whenever `lastOraclePrice` is current.
     *
     *   Between ack lag (Master's view trails Remote's `previewRedeem`) and Base-side oracle
     *   updates (`updateWOETHOraclePrice`), brief drift can appear: any yield accrued on the
     *   bridged shares but not yet reflected in Master's `checkBalance` shows up in the
     *   `inTransit` slot here. Each balance-check ack from Remote rebalances the two sides;
     *   drift size at any point is bounded by the yield accrued in a single ack window.
     *
     *   For the one-time 8.7k wOETH migration the bound is negligible (~minutes of yield);
     *   for a steady-state pipeline operators should set the balance-check cadence to keep
     *   the drift inside an acceptable accounting tolerance.
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        require(_asset == address(weth), "Unsupported asset");

        uint256 localWOETH = bridgedWOETH.balanceOf(address(this));

        uint256 inTransit = 0;
        if (master != address(0)) {
            uint256 masterBal = IStrategy(master).checkBalance(_asset);
            // Convert Master's WETH-denominated balance back to wOETH units so we can
            // subtract it from totalBridged (wOETH units). At the configured oracle price
            // this is the inverse of `value = amount * price / 1e18`.
            // wOETHFromValue = value * 1e18 / lastOraclePrice
            uint256 masterAsWOETH = lastOraclePrice == 0
                ? 0
                : (masterBal * 1 ether) / lastOraclePrice;
            if (totalBridged > masterAsWOETH) {
                inTransit = totalBridged - masterAsWOETH;
            }
        } else if (totalBridged > 0) {
            // Pre-config conservative path: count all bridged as in-transit.
            inTransit = totalBridged;
        }

        balance = ((localWOETH + inTransit) * lastOraclePrice) / 1 ether;
    }

    // --- Asset support / pTokens -----------------------------------------

    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == address(weth);
    }

    function safeApproveAllTokens() external override {}

    function _abstractSetPToken(address, address) internal override {
        revert("No pTokens are used");
    }

    function removePToken(uint256) external override {
        revert("No pTokens are used");
    }

    function collectRewardTokens() external override {}

    function transferToken(address _asset, uint256 _amount)
        public
        override
        onlyGovernor
    {
        require(
            _asset != address(bridgedWOETH) && _asset != address(weth),
            "Cannot transfer supported asset"
        );
        IERC20(_asset).safeTransfer(governor(), _amount);
    }

    // --- V1 ops, retained for backward compatibility ----------------------

    function depositBridgedWOETH(uint256 woethAmount)
        external
        onlyGovernorOrStrategist
        nonReentrant
    {
        uint256 oraclePrice = _updateWOETHOraclePrice();
        uint256 oethToMint = (woethAmount * oraclePrice) / 1 ether;
        require(oethToMint > 0, "Invalid deposit amount");
        emit Deposit(address(weth), address(bridgedWOETH), oethToMint);
        IVault(vaultAddress).mintForStrategy(oethToMint);
        oethb.transfer(msg.sender, oethToMint);
        bridgedWOETH.transferFrom(msg.sender, address(this), woethAmount);
    }

    function withdrawBridgedWOETH(uint256 oethToBurn)
        external
        onlyGovernorOrStrategist
        nonReentrant
    {
        uint256 oraclePrice = _updateWOETHOraclePrice();
        uint256 woethAmount = (oethToBurn * 1 ether) / oraclePrice;
        require(woethAmount > 0, "Invalid withdraw amount");
        emit Withdrawal(address(weth), address(bridgedWOETH), oethToBurn);
        bridgedWOETH.transfer(msg.sender, woethAmount);
        oethb.transferFrom(msg.sender, address(this), oethToBurn);
        IVault(vaultAddress).burnForStrategy(oethToBurn);
    }

    function deposit(address, uint256)
        external
        override
        onlyVault
        nonReentrant
    {
        revert("Deposit disabled");
    }

    function depositAll() external override onlyVault nonReentrant {
        revert("Deposit disabled");
    }

    function withdraw(
        address,
        address,
        uint256
    ) external override onlyVault nonReentrant {
        revert("Withdrawal disabled");
    }

    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        // Withdrawal disabled
    }
}
