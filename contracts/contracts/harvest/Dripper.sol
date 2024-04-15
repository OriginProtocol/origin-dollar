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

contract Dripper is Governable {
    using SafeERC20 for IERC20;

    struct Drip {
        uint64 lastCollect; // overflows 262 billion years after the sun dies
        uint192 perBlock; // drip rate per block
    }

    address immutable vault; // OUSD vault
    address immutable token; // token to drip out
    uint256 public dripDuration; // in seconds
    Drip public drip; // active drip parameters

    constructor(address _vault, address _token) {
        vault = _vault;
        token = _token;
    }

    /// @notice How much funds have dripped out already and are currently
    //   available to be sent to the vault.
    /// @return The amount that would be sent if a collect was called
    function availableFunds() external view returns (uint256) {
        uint256 balance = IERC20(token).balanceOf(address(this));
        return _availableFunds(balance, drip);
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

    /// @dev Change the drip duration. Governor only.
    /// @param _durationSeconds the number of seconds to drip out the entire
    ///  balance over if no collects were called during that time.
    function setDripDuration(uint256 _durationSeconds) external onlyGovernor {
        require(_durationSeconds > 0, "duration must be non-zero");
        dripDuration = _durationSeconds;
        _collect(); // duration change take immediate effect
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
    /// @param _drip current drip parameters
    function _availableFunds(uint256 _balance, Drip memory _drip)
        internal
        view
        returns (uint256)
    {
        uint256 elapsed = block.timestamp - _drip.lastCollect;
        uint256 allowed = (elapsed * _drip.perBlock);
        return (allowed > _balance) ? _balance : allowed;
    }

    /// @dev Sends the currently dripped funds to be vault, and sets
    ///  the new drip rate based on the new balance.
    function _collect() internal {
        // Calculate send
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 amountToSend = _availableFunds(balance, drip);
        uint256 remaining = balance - amountToSend;
        // Calculate new drip perBlock
        //   Gas savings by setting entire struct at one time
        drip = Drip({
            perBlock: uint192(remaining / dripDuration),
            lastCollect: uint64(block.timestamp)
        });
        // Send funds
        IERC20(token).safeTransfer(vault, amountToSend);
    }
}
