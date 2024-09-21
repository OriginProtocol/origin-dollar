// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Governable } from "../governance/Governable.sol";
import { IVault } from "../interfaces/IVault.sol";

/**
 * @title OUSD Dripper
 *
 * The dripper contract smooths out the yield from point-in-time yield events
 * and spreads the yield out over a configurable time period. This ensures a
 * continuous per block yield to makes users happy as their next rebase
 * amount is always moving up. Also, this makes historical day to day yields
 * smooth, rather than going from a near zero day, to a large APY day, then
 * back to a near zero day again.
 *
 *
 * Design notes
 * - USDT has a smaller resolution than the number of seconds
 * in a week, which can make per block payouts have a rounding error. However
 * the total effect is not large - cents per day, and this money is
 * not lost, just distributed in the future. While we could use a higher
 * decimal precision for the drip perBlock, we chose simpler code.
 * - By calculating the changing drip rates on collects only, harvests and yield
 * events don't have to call anything on this contract or pay any extra gas.
 * Collect() is already be paying for a single write, since it has to reset
 * the lastCollect time.
 * - By having a collectAndRebase method, and having our external systems call
 * that, the OUSD vault does not need any changes, not even to know the address
 * of the dripper.
 * - A rejected design was to retro-calculate the drip rate on each collect,
 * based on the balance at the time of the collect. While this would have
 * required less state, and would also have made the contract respond more quickly
 * to new income, it would break the predictability that is this contract's entire
 * purpose. If we did this, the amount of fundsAvailable() would make sharp increases
 * when funds were deposited.
 * - When the dripper recalculates the rate, it targets spending the balance over
 * the duration. This means that every time that collect is called, if no
 * new funds have been deposited the duration is being pushed back and the
 * rate decreases. This is expected, and ends up following a smoother but
 * longer curve the more collect() is called without incoming yield.
 *
 */

contract FixedRateDripper is Governable {
    using SafeERC20 for IERC20;

    address immutable vault; // OUSD vault
    address immutable token; // token to drip out
    uint256 public dripRate; // WETH per second
    uint256 public lastCollect; // Last collect timestamp

    constructor(address _vault, address _token) {
        vault = _vault;
        token = _token;
    }

    /// @notice How much funds have dripped out already and are currently
    //   available to be sent to the vault.
    /// @return The amount that would be sent if a collect was called
    function availableFunds() external view returns (uint256) {
        uint256 balance = IERC20(token).balanceOf(address(this));
        return _availableFunds(balance);
    }

    /// @notice Collect all dripped funds and send to vault.
    ///  Recalculate new drip rate.
    function collect() external {
        _collect();
    }

    /// @notice Collect all dripped funds, send to vault, recalculate new drip
    ///  rate, and rebase OUSD.
    function collectAndRebase() external {
        _collect();
        IVault(vault).rebase();
    }

    /// @dev Change the drip rate. Governor only.
    /// @param _rate Amount of token to drip per second
    ///  balance over if no collects were called during that time.
    function setDripRate(uint256 _rate) external onlyGovernor {
        require(_rate > 0, "rate must be non-zero");
        // Collect at current rate
        _collect();
        // Update the rate
        dripRate = _rate;
    }

    /// @dev Transfer out ERC20 tokens held by the contract. Governor only.
    /// @param _asset ERC20 token address
    /// @param _amount amount to transfer
    function transferToken(address _asset, uint256 _amount)
        external
        onlyGovernor
    {
        IERC20(_asset).safeTransfer(governor(), _amount);
    }

    /// @dev Calculate available funds by taking the lower of either the
    ///  currently dripped out funds or the balance available.
    ///  Uses passed in parameters to calculate with for gas savings.
    /// @param _balance current balance in contract
    function _availableFunds(uint256 _balance) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - lastCollect;
        uint256 allowed = (elapsed * dripRate);
        return (allowed > _balance) ? _balance : allowed;
    }

    /// @dev Sends the currently dripped funds to be vault, and sets
    ///  the new drip rate based on the new balance.
    function _collect() internal {
        // Calculate send
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 amountToSend = _availableFunds(balance);
        lastCollect = block.timestamp;

        // Send funds
        IERC20(token).safeTransfer(vault, amountToSend);
    }
}
