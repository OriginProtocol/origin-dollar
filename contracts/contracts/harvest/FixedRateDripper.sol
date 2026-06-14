// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IVault } from "../interfaces/IVault.sol";
import { Dripper } from "./Dripper.sol";

/**
 * @title Fixed Rate Dripper
 *
 * Similar to the Dripper, Fixed Rate Dripper drips out yield per second.
 * However the Strategist decides the rate and it doesn't change after
 * a drip.
 *
 */

contract FixedRateDripper is Dripper {
    using SafeERC20 for IERC20;

    event DripRateUpdated(uint192 oldDripRate, uint192 newDripRate);

    /**
     * @dev Verifies that the caller is the Governor or Strategist.
     */
    modifier onlyGovernorOrStrategist() {
        require(
            isGovernor() || msg.sender == IVault(vault).strategistAddr(),
            "Caller is not the Strategist or Governor"
        );
        _;
    }

    constructor(address _vault, address _token) Dripper(_vault, _token) {}

    /// @inheritdoc Dripper
    function setDripDuration(uint256) external virtual override {
        // Not used in FixedRateDripper
        revert("Drip duration disabled");
    }

    /// @inheritdoc Dripper
    function _collect() internal virtual override {
        // Calculate amount to send
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 amountToSend = _availableFunds(balance, drip);

        // Update timestamp
        drip.lastCollect = uint64(block.timestamp);

        // Send funds
        IERC20(token).safeTransfer(vault, amountToSend);
    }

    /**
     * @dev Sets the drip rate. Callable by Strategist or Governor.
     *      Can be set to zero to stop dripper.
     * @param _perSecond Rate of WETH to drip per second
     */
    function setDripRate(uint192 _perSecond) external onlyGovernorOrStrategist {
        emit DripRateUpdated(drip.perSecond, _perSecond);

        /**
         * Note: It's important to call `_collect` before updating
         * the drip rate especially on a new proxy contract.
         * When `lastCollect` is not set/initialized, the elapsed
         * time would be calculated as `block.number` seconds,
         * resulting in a huge yield, if `collect` isn't called first.
         */
        // Collect at existing rate
        _collect();

        // Update rate
        drip.perSecond = _perSecond;
    }
}
