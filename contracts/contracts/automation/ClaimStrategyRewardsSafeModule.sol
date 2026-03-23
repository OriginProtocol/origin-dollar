// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";

import { ISafe } from "../interfaces/ISafe.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ClaimStrategyRewardsSafeModule is AbstractSafeModule {
    mapping(address => bool) public isStrategyWhitelisted;
    address[] public strategies;

    /// @notice Address to forward claimed reward tokens to
    address public rewardsTo;

    event StrategyAdded(address strategy);
    event StrategyRemoved(address strategy);
    event RewardsToUpdated(address newRewardsTo);

    event ClaimRewardsFailed(address strategy);
    event RewardTokensForwarded(
        address strategy,
        address token,
        uint256 amount
    );
    event ForwardRewardsFailed(address strategy, address token);

    constructor(
        address _safeAddress,
        address operator,
        address[] memory _strategies,
        address _rewardsTo
    ) AbstractSafeModule(_safeAddress) {
        _grantRole(OPERATOR_ROLE, operator);
        _setRewardsTo(_rewardsTo);

        // Whitelist all strategies
        for (uint256 i = 0; i < _strategies.length; i++) {
            _addStrategy(_strategies[i]);
        }
    }

    /**
     * @dev Claim rewards from all whitelisted strategies and forward to rewardsTo
     * @param silent Doesn't revert on error if set to true
     */
    function claimRewards(bool silent) external onlyRole(OPERATOR_ROLE) {
        uint256 strategiesLength = strategies.length;
        for (uint256 i = 0; i < strategiesLength; i++) {
            _claimRewardsFor(strategies[i], silent);
        }
    }

    /**
     * @dev Claim rewards from a single whitelisted strategy and forward to rewardsTo
     * @param strategy The strategy to claim rewards from
     * @param silent Doesn't revert on error if set to true
     */
    function claimRewardsFor(address strategy, bool silent)
        external
        onlyRole(OPERATOR_ROLE)
    {
        require(isStrategyWhitelisted[strategy], "Strategy not whitelisted");
        _claimRewardsFor(strategy, silent);
    }

    /**
     * @dev Internal: collect rewards from one strategy and forward tokens to rewardsTo.
     *      Tokens land in the Safe after collectRewardTokens(), so forwarding also
     *      goes through execTransactionFromModule.
     */
    function _claimRewardsFor(address strategy, bool silent) internal {
        address[] memory rewardTokens = IStrategy(strategy)
            .getRewardTokenAddresses();

        // Snapshot Safe balances before claiming
        uint256[] memory balancesBefore = new uint256[](rewardTokens.length);
        for (uint256 j = 0; j < rewardTokens.length; j++) {
            balancesBefore[j] = IERC20(rewardTokens[j]).balanceOf(
                address(safeContract)
            );
        }

        // Collect reward tokens into the Safe
        bool success = safeContract.execTransactionFromModule(
            strategy,
            0, // Value
            abi.encodeWithSelector(IStrategy.collectRewardTokens.selector),
            0 // Call
        );

        if (!success) {
            emit ClaimRewardsFailed(strategy);
        }
        require(success || silent, "Failed to claim rewards");

        if (!success) {
            return;
        }

        // Forward newly collected tokens from the Safe to rewardsTo
        for (uint256 j = 0; j < rewardTokens.length; j++) {
            address token = rewardTokens[j];
            uint256 amount = IERC20(token).balanceOf(address(safeContract)) -
                balancesBefore[j];
            if (amount == 0) {
                continue;
            }

            bool transferSuccess = safeContract.execTransactionFromModule(
                token,
                0, // Value
                abi.encodeWithSelector(
                    IERC20.transfer.selector,
                    rewardsTo,
                    amount
                ),
                0 // Call
            );

            if (!transferSuccess) {
                emit ForwardRewardsFailed(strategy, token);
            } else {
                emit RewardTokensForwarded(strategy, token, amount);
            }
            require(
                transferSuccess || silent,
                "Failed to forward reward tokens"
            );
        }
    }

    /**
     * @dev Update the address that claimed reward tokens are forwarded to
     * @param _rewardsTo New rewards destination address
     */
    function setRewardsTo(address _rewardsTo)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setRewardsTo(_rewardsTo);
    }

    function _setRewardsTo(address _rewardsTo) internal {
        require(_rewardsTo != address(0), "Invalid rewardsTo address");
        rewardsTo = _rewardsTo;
        emit RewardsToUpdated(_rewardsTo);
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
