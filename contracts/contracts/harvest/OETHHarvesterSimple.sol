// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Governable } from "../governance/Governable.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract OETHHarvesterSimple is Governable {
    ////////////////////////////////////////////////////
    /// --- STORAGE
    ////////////////////////////////////////////////////
    address public operator;
    address public strategy;
    address public strategist;

    ////////////////////////////////////////////////////
    /// --- EVENTS
    ////////////////////////////////////////////////////
    event Harvested(address token, uint256 amount);
    event OperatorSet(address operator);
    event StrategySet(address strategy);
    event StrategistSet(address strategist);

    ////////////////////////////////////////////////////
    /// --- MODIFIERS
    ////////////////////////////////////////////////////
    modifier onlyOperator() {
        require(
            msg.sender == operator || isGovernor(),
            "Only Operator or Governor"
        );
        _;
    }

    ////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    ////////////////////////////////////////////////////
    constructor(
        address _governor,
        address _operator,
        address _strategist,
        address _strategy
    ) {
        operator = _operator;
        strategy = _strategy;
        strategist = _strategist;
        _setGovernor(_governor);
    }

    ////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    ////////////////////////////////////////////////////
    function harvestAndTransfer() external onlyOperator {
        require(strategy != address(0), "Strategy not set");
        require(strategist != address(0), "Strategist not set");

        IStrategy(strategy).collectRewardTokens();

        address[] memory rewardTokens = IStrategy(strategy)
            .getRewardTokenAddresses();
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            uint256 balance = IERC20(rewardTokens[i]).balanceOf(address(this));
            if (balance > 0) {
                IERC20(rewardTokens[i]).transfer(strategist, balance);
                emit Harvested(rewardTokens[i], balance);
            }
        }
    }

    ////////////////////////////////////////////////////
    /// --- GOVERNANCE
    ////////////////////////////////////////////////////
    function setOperator(address _operator) external onlyGovernor {
        operator = _operator;
        emit OperatorSet(_operator);
    }

    function setStrategy(address _strategy) external onlyGovernor {
        strategy = _strategy;
        emit StrategySet(_strategy);
    }

    function setStrategist(address _strategist) external onlyGovernor {
        strategist = _strategist;
        emit StrategistSet(_strategist);
    }
}
