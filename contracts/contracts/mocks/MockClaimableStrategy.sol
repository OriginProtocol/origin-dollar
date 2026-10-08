// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockClaimableStrategy
 * @dev Mock strategy for testing ClaimStrategyRewardsSafeModule.
 *      Holds reward tokens and transfers them to msg.sender on collectRewardTokens().
 */
contract MockClaimableStrategy {
    address[] private _rewardTokenAddresses;
    bool public shouldRevert;

    function setRewardTokenAddresses(address[] memory tokens) external {
        _rewardTokenAddresses = tokens;
    }

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    function getRewardTokenAddresses()
        external
        view
        returns (address[] memory)
    {
        return _rewardTokenAddresses;
    }

    /**
     * @dev Transfers all held reward tokens to msg.sender (the Safe).
     *      Reverts if shouldRevert is set, causing the Safe module exec to return false.
     */
    function collectRewardTokens() external {
        require(!shouldRevert, "MockClaimableStrategy: forced revert");
        for (uint256 i = 0; i < _rewardTokenAddresses.length; i++) {
            uint256 balance = IERC20(_rewardTokenAddresses[i]).balanceOf(
                address(this)
            );
            if (balance > 0) {
                IERC20(_rewardTokenAddresses[i]).transfer(msg.sender, balance);
            }
        }
    }
}
