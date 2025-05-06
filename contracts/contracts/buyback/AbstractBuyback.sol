// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Strategizable } from "../governance/Strategizable.sol";
import "../interfaces/chainlink/AggregatorV3Interface.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ICVXLocker } from "../interfaces/ICVXLocker.sol";
import { ISwapper } from "../interfaces/ISwapper.sol";

import { Initializable } from "../utils/Initializable.sol";

abstract contract AbstractBuyback is Initializable, Strategizable {
    using SafeERC20 for IERC20;

    // Address of 1-inch Swap Router
    address public __deprecated_swapRouter;

    // slither-disable-next-line constable-states
    address private __deprecated_ousd;
    // slither-disable-next-line constable-states
    address private __deprecated_ogv;
    // slither-disable-next-line constable-states
    address private __deprecated_usdt;
    // slither-disable-next-line constable-states
    address private __deprecated_weth9;

    // Address that receives OGN after swaps
    // slither-disable-next-line constable-states
    address public __deprecated_rewardsSource;

    // Address that receives all other tokens after swaps
    // slither-disable-next-line constable-states
    address public __deprecated_treasuryManager;

    // slither-disable-next-line constable-states
    uint256 private __deprecated_treasuryBps;

    // Amount of `oToken` balance to use for OGN buyback
    // slither-disable-next-line constable-states
    uint256 public __deprecated_balanceForOGN;

    // Amount of `oToken` balance to use for CVX buyback
    // slither-disable-next-line constable-states
    uint256 public __deprecated_balanceForCVX;

    // Percentage of `oToken` balance to be used for CVX
    // slither-disable-next-line constable-states
    uint256 public __deprecated_cvxShareBps; // 10000 = 100%

    constructor() {
        // Make sure nobody owns the implementation contract
        _setGovernor(address(0));
    }

    /**
     * @notice Owner function to withdraw a specific amount of a token
     *          to the guardian (2/8 multisig)
     * @param token token to be transferered
     * @param amount amount of the token to be transferred
     */
    function transferToken(address token, uint256 amount)
        external
        onlyGovernorOrStrategist
        nonReentrant
    {
        address _recipient = strategistAddr;
        require(_recipient != address(0), "Strategist address not set");
        IERC20(token).safeTransfer(_recipient, amount);
    }
}
