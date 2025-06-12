// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AccessControlEnumerable } from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ISafe } from "../interfaces/ISafe.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ClaimStrategyRewardsSafeModule is AccessControlEnumerable {
    using SafeERC20 for IERC20;
    ISafe public immutable safeAddress;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    mapping(address => bool) public isStrategyWhitelisted;
    address[] public strategies;

    event StrategyAdded(address strategy);
    event StrategyRemoved(address strategy);

    constructor(address _safeAddress, address[] memory _strategies) {
        // Safe is the admin
        _setupRole(DEFAULT_ADMIN_ROLE, _safeAddress);

        _setupRole(OPERATOR_ROLE, _safeAddress);

        // Whitelist all strategies
        for (uint256 i = 0; i < _strategies.length; i++) {
            _addStrategy(_strategies[i]);
        }
    }

    /**
     * @dev Claim rewards from all whitelisted strategies
     */
    function claimRewards() external onlyRole(OPERATOR_ROLE) {
        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];

            // Execute `collectRewardTokens` for all strategies
            ISafe(safeAddress).execTransactionFromModule(
                strategy, // To
                0, // Value
                abi.encodeWithSelector(IStrategy.collectRewardTokens.selector),
                0 // Call
            );
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
