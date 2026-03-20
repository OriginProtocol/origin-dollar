// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AbstractSafeModule } from "./AbstractSafeModule.sol";

import { ISafe } from "../interfaces/ISafe.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ClaimStrategyRewardsSafeModule is AbstractSafeModule {
    using SafeERC20 for IERC20;

    mapping(address => bool) public isStrategyWhitelisted;
    address[] public strategies;

    event StrategyAdded(address strategy);
    event StrategyRemoved(address strategy);

    event ClaimRewardsFailed(address strategy);

    constructor(
        address _safeAddress,
        address operator,
        address[] memory _strategies
    ) AbstractSafeModule(_safeAddress) {
        _grantRole(OPERATOR_ROLE, operator);

        // Whitelist all strategies
        for (uint256 i = 0; i < _strategies.length; i++) {
            _addStrategy(_strategies[i]);
        }
    }

    /**
     * @dev Claim rewards from all whitelisted strategies
     * @param silent Doesn't revert on error if set to true
     */
    function claimRewards(bool silent) external onlyRole(OPERATOR_ROLE) {
        uint256 strategiesLength = strategies.length;
        for (uint256 i = 0; i < strategiesLength; i++) {
            address strategy = strategies[i];

            // Execute `collectRewardTokens` for all strategies
            bool success = safeContract.execTransactionFromModule(
                strategy, // To
                0, // Value
                abi.encodeWithSelector(IStrategy.collectRewardTokens.selector),
                0 // Call
            );

            if (!success) {
                emit ClaimRewardsFailed(strategy);
            }

            require(success || silent, "Failed to claim rewards");
        }
    }

    /**
     * @dev Add a strategy to the whitelist
     * @param _strategy The address of the strategy to add
     */
    function addStrategy(address _strategy)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _addStrategy(_strategy);
    }

    function _addStrategy(address _strategy) internal {
        require(
            !isStrategyWhitelisted[_strategy],
            "Strategy already whitelisted"
        );
        isStrategyWhitelisted[_strategy] = true;
        strategies.push(_strategy);
        emit StrategyAdded(_strategy);
    }

    /**
     * @dev Remove a strategy from the whitelist
     * @param _strategy The address of the strategy to remove
     */
    function removeStrategy(address _strategy)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(isStrategyWhitelisted[_strategy], "Strategy not whitelisted");
        isStrategyWhitelisted[_strategy] = false;

        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i] == _strategy) {
                strategies[i] = strategies[strategies.length - 1];
                strategies.pop();
                break;
            }
        }

        emit StrategyRemoved(_strategy);
    }
}
