// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { IVault } from "../interfaces/IVault.sol";
import { AggregatorV3Interface } from "../interfaces/chainlink/AggregatorV3Interface.sol";
import { StableMath } from "../utils/StableMath.sol";

contract BridgedWOETHStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;

    IWETH9 public immutable weth;
    IERC20 public immutable bridgedWOETH;

    // TODO: Should this strategy also use Oracle Router?
    AggregatorV3Interface public immutable oracleFeed;
    uint8 public immutable oracleFeedDecimals;

    uint256 public constant MAX_PRICE_STALENESS = 2 days;

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
        address _oracleFeed
    ) InitializableAbstractStrategy(_stratConfig) {
        weth = IWETH9(_weth);
        bridgedWOETH = IERC20(_bridgedWOETH);

        oracleFeed = AggregatorV3Interface(_oracleFeed);
        oracleFeedDecimals = AggregatorV3Interface(_oracleFeed).decimals();
    }

    function initialize() external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            new address[](0), // No reward tokens
            new address[](0), // No assets
            new address[](0) // No pTokens
        );
    }

    function getBridgedWOETHValue(uint256 amount)
        public
        view
        returns (uint256 oethValue)
    {
        // slither-disable-next-line unused-return
        (, int256 oraclePrice, , uint256 updatedAt, ) = AggregatorV3Interface(
            oracleFeed
        ).latestRoundData();

        require(
            updatedAt + MAX_PRICE_STALENESS >= block.timestamp,
            "Oracle price too old"
        );

        // Price per unit bridged wOETH
        oethValue = uint256(oraclePrice).scaleBy(18, oracleFeedDecimals);

        // Price for `amount`
        oethValue = (amount * oethValue) / 1 ether;
    }

    // TODO: Add minAmount
    function depositBridgedWOETH(uint256 woethAmount)
        external
        onlyGovernorOrStrategist
    {
        // Transfer in all bridged wOETH tokens
        bridgedWOETH.transferFrom(msg.sender, address(this), woethAmount);

        // Figure out how much they are worth
        uint256 oethToMint = getBridgedWOETHValue(woethAmount);

        // There's no pToken, however, it just uses WOETH address in the event
        emit Deposit(address(weth), address(bridgedWOETH), oethToMint);

        // Mint OETHb tokens and transfer it to the caller
        IVault(vaultAddress).mintToForStrategy(msg.sender, oethToMint);
    }

    function withdrawBridgedWOETH(uint256 woethAmount, address receiver)
        external
        onlyGovernorOrStrategist
    {
        uint256 oethToBurn = getBridgedWOETHValue(woethAmount);

        // There's no pToken, however, it just uses WOETH address in the event
        emit Withdrawal(address(weth), address(bridgedWOETH), oethToBurn);

        // Burn OETHb
        IVault(vaultAddress).burnFromForStrategy(msg.sender, oethToBurn);

        // Transfer WOETH back
        bridgedWOETH.transfer(receiver, woethAmount);
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

        // Figure out how much wOETH is worth at the time
        balance = getBridgedWOETHValue(bridgedWOETH.balanceOf(address(this)));
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
     * @notice deposit() function not used for this strategy
     */
    function deposit(address, uint256) public override onlyVault nonReentrant {
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
        require(false, "Withdrawal disabled");
    }

    function _abstractSetPToken(address, address) internal override {
        revert("No pTokens are used");
    }

    function safeApproveAllTokens() external override {}
}
