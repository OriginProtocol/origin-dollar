// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Governable } from "../governance/Governable.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract OETHHarvesterSimple is Governable {
    ////////////////////////////////////////////////////
    /// --- STORAGE
    ////////////////////////////////////////////////////
    address public strategist;
    mapping(address => bool) public supportedStrategies;

    ////////////////////////////////////////////////////
    /// --- EVENTS
    ////////////////////////////////////////////////////
    event Harvested(address token, uint256 amount);
    event StrategistUpdated(address strategist);
    event SupportedStrategyUpdated(address strategy, bool status);

    ////////////////////////////////////////////////////
    /// --- MODIFIERS
    ////////////////////////////////////////////////////
    modifier onlyStrategist() {
        require(msg.sender == strategist || isGovernor(), "Not strategist");
        _;
    }

    ////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    ////////////////////////////////////////////////////
    constructor(address _governor, address _strategist) {
        _setStrategist(_strategist);
        _changeGovernor(_governor);
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
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            // Cache balance
            uint256 balance = IERC20(rewardTokens[i]).balanceOf(address(this));
            if (balance > 0) {
                // Transfer to strategist
                IERC20(rewardTokens[i]).transfer(strategist, balance);
                emit Harvested(rewardTokens[i], balance);
            }
        }
    }

    ////////////////////////////////////////////////////
    /// --- GOVERNANCE
    ////////////////////////////////////////////////////
    function setSupportedStrategy(address _strategy, bool _isSupported)
        external
        onlyStrategist
    {
        require(_strategy != address(0), "Invalid strategy");
        supportedStrategies[_strategy] = _isSupported;
        emit SupportedStrategyUpdated(_strategy, _isSupported);
    }

    function _setStrategist(address _strategist) internal {
        require(_strategist != address(0), "Invalid strategist");
        strategist = _strategist;
        emit StrategistUpdated(_strategist);
    }

    function setStrategist(address _strategist) external onlyGovernor {
        _setStrategist(_strategist);
    }
}
