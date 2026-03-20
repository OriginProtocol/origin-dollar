// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Strategizable } from "../governance/Strategizable.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Initializable } from "../utils/Initializable.sol";

/// @title OETH Harvester Simple Contract
/// @notice Contract to harvest rewards from strategies
/// @author Origin Protocol Inc
contract OETHHarvesterSimple is Initializable, Strategizable {
    using SafeERC20 for IERC20;

    ////////////////////////////////////////////////////
    /// --- CONSTANTS & IMMUTABLES
    ////////////////////////////////////////////////////
    /// @notice wrapped native token address (WETH or wS)
    address public immutable wrappedNativeToken;

    ////////////////////////////////////////////////////
    /// --- STORAGE
    ////////////////////////////////////////////////////
    /// @notice Dripper address
    address public dripper;

    /// @notice Mapping of supported strategies
    mapping(address => bool) public supportedStrategies;

    /// @notice Gap for upgrade safety
    uint256[48] private ___gap;

    ////////////////////////////////////////////////////
    /// --- EVENTS
    ////////////////////////////////////////////////////
    event Harvested(
        address indexed strategy,
        address token,
        uint256 amount,
        address indexed receiver
    );
    event SupportedStrategyUpdated(address strategy, bool status);
    event DripperUpdated(address dripper);

    ////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    ////////////////////////////////////////////////////
    constructor(address _wrappedNativeToken) {
        wrappedNativeToken = _wrappedNativeToken;

        // prevent implementation contract to be governed
        _setGovernor(address(0));
    }

    /// @notice Initialize the contract
    function initialize() external onlyGovernor initializer {
        // Call it to set `initialized` to true and to prevent the implementation
        // from getting initialized in future through the proxy
    }

    ////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    ////////////////////////////////////////////////////
    /// @notice Harvest rewards from a strategy and transfer to strategist or dripper
    /// @param _strategy Address of the strategy to harvest
    function harvestAndTransfer(address _strategy) external {
        _harvestAndTransfer(_strategy);
    }

    /// @notice Harvest rewards from multiple strategies and transfer to strategist or dripper
    /// @param _strategies Array of strategy addresses to harvest
    function harvestAndTransfer(address[] calldata _strategies) external {
        for (uint256 i = 0; i < _strategies.length; i++) {
            _harvestAndTransfer(_strategies[i]);
        }
    }

    /// @notice Internal logic to harvest rewards from a strategy
    function _harvestAndTransfer(address _strategy) internal virtual {
        // Ensure strategy is supported
        require(supportedStrategies[_strategy], "Strategy not supported");

        // Store locally for some gas savings
        address _strategist = strategistAddr;
        address _dripper = dripper;

        // Harvest rewards
        IStrategy(_strategy).collectRewardTokens();

        // Cache reward tokens
        address[] memory rewardTokens = IStrategy(_strategy)
            .getRewardTokenAddresses();

        uint256 len = rewardTokens.length;
        for (uint256 i = 0; i < len; i++) {
            // Cache balance
            address token = rewardTokens[i];
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                // Determine receiver
                address receiver = token == wrappedNativeToken
                    ? _dripper
                    : _strategist;
                require(receiver != address(0), "Invalid receiver");

                // Transfer to the Strategist or the Dripper
                IERC20(token).safeTransfer(receiver, balance);
                emit Harvested(_strategy, token, balance, receiver);
            }
        }
    }

    ////////////////////////////////////////////////////
    /// --- GOVERNANCE
    ////////////////////////////////////////////////////
    /// @notice Set supported strategy
    /// @param _strategy Address of the strategy
    /// @param _isSupported Boolean indicating if strategy is supported
    function setSupportedStrategy(address _strategy, bool _isSupported)
        external
        onlyGovernorOrStrategist
    {
        require(_strategy != address(0), "Invalid strategy");
        supportedStrategies[_strategy] = _isSupported;
        emit SupportedStrategyUpdated(_strategy, _isSupported);
    }

    /// @notice Transfer tokens to strategist
    /// @param _asset Address of the token
    /// @param _amount Amount of tokens to transfer
    function transferToken(address _asset, uint256 _amount)
        external
        onlyGovernorOrStrategist
    {
        IERC20(_asset).safeTransfer(strategistAddr, _amount);
    }

    /// @notice Set the dripper address
    /// @param _dripper Address of the dripper
    function setDripper(address _dripper) external onlyGovernor {
        _setDripper(_dripper);
    }

    /// @notice Internal logic to set the dripper address
    function _setDripper(address _dripper) internal {
        require(_dripper != address(0), "Invalid dripper");
        dripper = _dripper;
        emit DripperUpdated(_dripper);
    }
}
