// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Initializable } from "../utils/Initializable.sol";
import { Strategizable } from "../governance/Strategizable.sol";

/// @title ERC20Rescue
/// @author Origin Protocol
/// @notice Contract to recover ERC20 tokens sent to the contract
contract ERC20Rescue is Initializable, Strategizable {
    using SafeERC20 for IERC20;

    ////////////////////////////////////////////////////
    /// --- EVENTS
    ////////////////////////////////////////////////////
    event TokensRescued(address token, uint256 amount, address receiver);

    ////////////////////////////////////////////////////
    /// --- CONSTRUCTOR && INITIALIZATION
    ////////////////////////////////////////////////////
    constructor() {
        // Prevent implementation contract to be governed
        _setGovernor(address(0));
    }

    /// @notice initialize function, to set up initial internal state
    /// @param _strategist Address of the strategist
    function initialize(address _strategist) external onlyGovernor initializer {
        _setStrategistAddr(_strategist);
    }

    /// @notice Rescue ERC20 tokens from the contract
    /// @dev Only callable by the governor or strategist
    /// @param token Address of the token to rescue
    function rescueToken(address token, address receiver)
        external
        nonReentrant
        onlyGovernorOrStrategist
    {
        require(receiver != address(0), "Invalid receiver");
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(receiver, balance);
        emit TokensRescued(token, balance, receiver);
    }
}
