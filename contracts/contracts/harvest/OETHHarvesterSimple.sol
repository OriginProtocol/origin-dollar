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
    address public strategist;
    mapping(address => bool) public isAuthorized;

    ////////////////////////////////////////////////////
    /// --- EVENTS
    ////////////////////////////////////////////////////
    event Harvested(address token, uint256 amount);
    event OperatorSet(address operator);
    event StrategistSet(address strategist);
    event StrategyStatusSet(address strategy, bool status);

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
        address _strategist
    ) {
        require(_strategist != address(0), "Invalid strategist");
        operator = _operator;
        strategist = _strategist;
        _setGovernor(_governor);
    }

    ////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    ////////////////////////////////////////////////////
    function harvestAndTransfer(address _strategy) external onlyOperator {
        _harvestAndTransfer(_strategy);
    }

    function harvestAndTransfer(address[] calldata _strategies)
        external
        onlyOperator
    {
        for (uint256 i = 0; i < _strategies.length; i++) {
            _harvestAndTransfer(_strategies[i]);
        }
    }

    function _harvestAndTransfer(address _strategy) internal {
        // Ensure strategy is authorized
        require(isAuthorized[_strategy], "Not authorized");

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
    function setOperator(address _operator) external onlyGovernor {
        operator = _operator;
        emit OperatorSet(_operator);
    }

    function setStrategyStatus(address _strategy, bool _status)
        external
        onlyGovernor
    {
        isAuthorized[_strategy] = _status;
        emit StrategyStatusSet(_strategy, _status);
    }

    function setStrategist(address _strategist) external onlyGovernor {
        require(_strategist != address(0), "Invalid strategist");
        strategist = _strategist;
        emit StrategistSet(_strategist);
    }
}
