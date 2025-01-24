// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Strategizable } from "../governance/Strategizable.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract OETHHarvesterSimple is Strategizable {
    using SafeERC20 for IERC20;

    ////////////////////////////////////////////////////
    /// --- CONSTANTS & IMMUTABLES
    ////////////////////////////////////////////////////
    address public immutable WETH;

    ////////////////////////////////////////////////////
    /// --- STORAGE
    ////////////////////////////////////////////////////
    address public dripper;
    mapping(address => bool) public supportedStrategies;

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
    constructor(
        address _governor,
        address _strategist,
        address _dripper,
        address _weth
    ) {
        _setStrategistAddr(_strategist);
        _changeGovernor(_governor);
        _setDripper(_dripper);
        WETH = _weth;
    }

    ////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    ////////////////////////////////////////////////////
    function harvestAndTransfer(address _strategy) external {
        _harvestAndTransfer(_strategy);
    }

    function harvestAndTransfer(address[] calldata _strategies) external {
        for (uint256 i = 0; i < _strategies.length; i++) {
            _harvestAndTransfer(_strategies[i]);
        }
    }

    function _harvestAndTransfer(address _strategy) internal {
        // Ensure strategy is supported
        require(supportedStrategies[_strategy], "Strategy not supported");

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
                address receiver = token == WETH ? dripper : strategistAddr;
                require(receiver != address(0), "Invalid receiver");

                // Transfer to strategist
                IERC20(token).safeTransfer(receiver, balance);
                emit Harvested(_strategy, token, balance, receiver);
            }
        }
    }

    ////////////////////////////////////////////////////
    /// --- GOVERNANCE
    ////////////////////////////////////////////////////
    function setSupportedStrategy(address _strategy, bool _isSupported)
        external
        onlyGovernorOrStrategist
    {
        require(_strategy != address(0), "Invalid strategy");
        supportedStrategies[_strategy] = _isSupported;
        emit SupportedStrategyUpdated(_strategy, _isSupported);
    }

    function transferToken(address _asset, uint256 _amount)
        external
        onlyGovernorOrStrategist
    {
        IERC20(_asset).safeTransfer(strategistAddr, _amount);
    }

    function setDripper(address _dripper) external onlyGovernor {
        _setDripper(_dripper);
    }

    function _setDripper(address _dripper) internal {
        require(_dripper != address(0), "Invalid dripper");
        dripper = _dripper;
        emit DripperUpdated(_dripper);
    }
}
