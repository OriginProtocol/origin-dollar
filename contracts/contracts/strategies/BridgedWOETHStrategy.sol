// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20, SafeERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { IVault } from "../interfaces/IVault.sol";
import { AggregatorV3Interface } from "../interfaces/chainlink/AggregatorV3Interface.sol";
import { StableMath } from "../utils/StableMath.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IOracle } from "../interfaces/IOracle.sol";

contract BridgedWOETHStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using StableMath for uint128;
    using SafeCast for uint256;
    using SafeERC20 for IERC20;

    event MaxPriceDiffBpsUpdated(uint128 oldValue, uint128 newValue);
    event WOETHPriceUpdated(uint128 oldValue, uint128 newValue);

    IWETH9 public immutable weth;
    IERC20 public immutable bridgedWOETH;
    IERC20 public immutable oethb;

    uint256 public constant MAX_PRICE_STALENESS = 2 days;

    uint128 public lastOraclePrice;
    uint128 public maxPriceDiffBps;

    /**
     * @dev Verifies that the caller is the Governor or Strategist.
     */
    modifier onlyGovernorOrStrategist() {
        require(
            isGovernor() || msg.sender == IVault(vaultAddress).strategistAddr(),
            "Caller is not the Strategist or Governor"
        );
        _;
    }

    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _weth,
        address _bridgedWOETH,
        address _oethb
    ) InitializableAbstractStrategy(_stratConfig) {
        weth = IWETH9(_weth);
        bridgedWOETH = IERC20(_bridgedWOETH);
        oethb = IERC20(_oethb);
    }

    function initialize(uint128 _maxPriceDiffBps)
        external
        onlyGovernor
        initializer
    {
        InitializableAbstractStrategy._initialize(
            new address[](0), // No reward tokens
            new address[](0), // No assets
            new address[](0) // No pTokens
        );

        _setMaxPriceDiffBps(_maxPriceDiffBps);
    }

    /**
     * @dev Sets the max price diff bps for the wOETH value appreciation
     * @param _maxPriceDiffBps Bps value, 10k == 100%
     */
    function setMaxPriceDiffBps(uint128 _maxPriceDiffBps)
        external
        onlyGovernor
    {
        _setMaxPriceDiffBps(_maxPriceDiffBps);
    }

    /**
     * @dev Sets the max price diff bps for the wOETH value appreciation
     * @param _maxPriceDiffBps Bps value, 10k == 100%
     */
    function _setMaxPriceDiffBps(uint128 _maxPriceDiffBps) internal {
        require(
            _maxPriceDiffBps > 0 && _maxPriceDiffBps <= 10000,
            "Invalid bps value"
        );

        emit MaxPriceDiffBpsUpdated(maxPriceDiffBps, _maxPriceDiffBps);

        maxPriceDiffBps = _maxPriceDiffBps;
    }

    /**
     * @dev Wrapper for _updateWOETHOraclePrice with nonReentrant flag
     * @return The latest price of wOETH from Oracle
     */
    function updateWOETHOraclePrice() external nonReentrant returns (uint256) {
        return _updateWOETHOraclePrice();
    }

    /**
     * @dev Finds the value of bridged wOETH from the Oracle.
     *      Ensures that it's within the bounds and reasonable.
     *      And stores it.
     *
     *      NOTE: Intentionally not caching `Vault.priceProvider` here,
     *      since doing so would mean that we also have to update this
     *      strategy every time there's a change in oracle router.
     *      Besides on L2, the gas is considerably cheaper than mainnet.
     *
     * @return Latest price from oracle
     */
    function _updateWOETHOraclePrice() internal returns (uint256) {
        // WETH price per unit of bridged wOETH
        uint256 oraclePrice = IOracle(IVault(vaultAddress).priceProvider())
            .price(address(bridgedWOETH));

        // 1 wOETH > 1 WETH, always
        require(oraclePrice > 1 ether, "Invalid wOETH value");

        uint128 oraclePrice128 = oraclePrice.toUint128();

        // Do some checks
        if (lastOraclePrice > 0) {
            // Make sure the value only goes up
            require(oraclePrice128 >= lastOraclePrice, "Negative wOETH yield");

            // lastOraclePrice * (1 + maxPriceDiffBps)
            uint256 maxPrice = (lastOraclePrice * (1e4 + maxPriceDiffBps)) /
                1e4;

            // And that it's within the bounds.
            require(oraclePrice128 <= maxPrice, "Price diff beyond threshold");
        }

        emit WOETHPriceUpdated(lastOraclePrice, oraclePrice128);

        // Store the price
        lastOraclePrice = oraclePrice128;

        return oraclePrice;
    }

    /**
     * @dev Computes & returns the value of given wOETH in WETH
     * @param woethAmount Amount of wOETH
     * @return Value of wOETH in WETH (using the last stored oracle price)
     */
    function getBridgedWOETHValue(uint256 woethAmount)
        public
        view
        returns (uint256)
    {
        return (woethAmount * lastOraclePrice) / 1 ether;
    }

    /**
     * @dev Takes in bridged wOETH and mints & returns
     *      equivalent amount of OETHb.
     * @param woethAmount Amount of bridged wOETH to transfer in
     */
    function depositBridgedWOETH(uint256 woethAmount)
        external
        onlyGovernorOrStrategist
        nonReentrant
    {
        // Update wOETH price
        uint256 oraclePrice = _updateWOETHOraclePrice();

        // Figure out how much they are worth
        uint256 oethToMint = (woethAmount * oraclePrice) / 1 ether;

        require(oethToMint > 0, "Invalid deposit amount");

        // There's no pToken, however, it just uses WOETH address in the event
        emit Deposit(address(weth), address(bridgedWOETH), oethToMint);

        // Mint OETHb tokens and transfer it to the caller
        IVault(vaultAddress).mintForStrategy(oethToMint);

        // Transfer out minted OETHb
        // slither-disable-next-line unchecked-transfer unused-return
        oethb.transfer(msg.sender, oethToMint);

        // Transfer in all bridged wOETH tokens
        // slither-disable-next-line unchecked-transfer unused-return
        bridgedWOETH.transferFrom(msg.sender, address(this), woethAmount);
    }

    /**
     * @dev Takes in OETHb and burns it and returns
     *      equivalent amount of bridged wOETH.
     * @param oethToBurn Amount of OETHb to burn
     */
    function withdrawBridgedWOETH(uint256 oethToBurn)
        external
        onlyGovernorOrStrategist
        nonReentrant
    {
        // Update wOETH price
        uint256 oraclePrice = _updateWOETHOraclePrice();

        // Figure out how much they are worth
        uint256 woethAmount = (oethToBurn * 1 ether) / oraclePrice;

        require(woethAmount > 0, "Invalid withdraw amount");

        // There's no pToken, however, it just uses WOETH address in the event
        emit Withdrawal(address(weth), address(bridgedWOETH), oethToBurn);

        // Transfer WOETH back
        // slither-disable-next-line unchecked-transfer unused-return
        bridgedWOETH.transfer(msg.sender, woethAmount);

        // Transfer in OETHb
        // slither-disable-next-line unchecked-transfer unused-return
        oethb.transferFrom(msg.sender, address(this), oethToBurn);

        // Burn OETHb
        IVault(vaultAddress).burnForStrategy(oethToBurn);
    }

    /**
     * @notice Returns the amount of backing WETH the strategy holds
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        require(_asset == address(weth), "Unsupported asset");

        // Figure out how much wOETH is worth at the time.
        // Always uses the last stored oracle price.
        // Call updateWOETHOraclePrice manually to pull in latest yields.

        // NOTE: If the contract has been deployed but the call to
        // `updateWOETHOraclePrice()` has never been made, then this
        // will return zero. It should be fine because the strategy
        // should update the price whenever a deposit/withdraw happens.

        // If `updateWOETHOraclePrice()` hasn't been called in a while,
        // the strategy will underreport its holdings but never overreport it.

        balance =
            (bridgedWOETH.balanceOf(address(this)) * lastOraclePrice) /
            1 ether;
    }

    /**
     * @notice Check if an asset is supported.
     * @param _asset    Address of the asset
     * @return bool     Whether asset is supported
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        // Strategist deposits bridged wOETH but the contract only
        // reports the balance in WETH. As far as Vault is concerned,
        // it isn't aware of bridged wOETH token
        return _asset == address(weth);
    }

    /***************************************
               Overridden methods
    ****************************************/
    /**
     * @inheritdoc InitializableAbstractStrategy
     */
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

    /**
     * @notice deposit() function not used for this strategy
     */
    function deposit(address, uint256)
        external
        override
        onlyVault
        nonReentrant
    {
        // Use depositBridgedWOETH() instead
        require(false, "Deposit disabled");
    }

    /**
     * @notice depositAll() function not used for this strategy
     */
    function depositAll() external override onlyVault nonReentrant {
        // Use depositBridgedWOETH() instead
        require(false, "Deposit disabled");
    }

    /**
     * @notice withdraw() function not used for this strategy
     */
    function withdraw(
        // solhint-disable-next-line no-unused-vars
        address _recipient,
        // solhint-disable-next-line no-unused-vars
        address _asset,
        // solhint-disable-next-line no-unused-vars
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(false, "Withdrawal disabled");
    }

    /**
     * @notice withdrawAll() function not used for this strategy
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        // Withdrawal disabled
    }

    function _abstractSetPToken(address, address) internal override {
        revert("No pTokens are used");
    }

    function safeApproveAllTokens() external override {}

    /**
     * @inheritdoc InitializableAbstractStrategy
     */
    function removePToken(uint256) external override {
        revert("No pTokens are used");
    }

    /**
     * @inheritdoc InitializableAbstractStrategy
     */
    function collectRewardTokens() external override {}
}
