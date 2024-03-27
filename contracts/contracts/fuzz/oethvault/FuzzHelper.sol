// SPDX-License-Identifier: MIT
import {FuzzSetup} from "./FuzzSetup.sol";

/**
 * @title Contract containing internal helper functions.
 * @author Rappie <rappie@perimetersec.io>
 */
contract FuzzHelper is FuzzSetup {
    /**
     * @notice Get the total starting balance of OETH for all actors
     * @return total Total starting balance of OETH
     */
    function getTotalWethStartingBalance() internal returns (uint256 total) {
        total += STARTING_BALANCE * ACTORS.length;
    }

    /**
     * @notice Get the total starting balance of OETH for all actors including outsiders
     * @return total Total starting balance of OETH including outsiders
     */
    function getTotalWethStartingBalanceInclOutsiders()
        internal
        returns (uint256 total)
    {
        total += getTotalWethStartingBalance();
        total += STARTING_BALANCE_OUTSIDER; // rebasing outsider
        total += STARTING_BALANCE_OUTSIDER; // non-rebasing outsider
    }

    /**
     * @notice Get the total OETH balance of all actors
     * @return total Total OETH balance of all actors
     */
    function getTotalOethBalance() internal returns (uint256 total) {
        for (uint256 i = 0; i < ACTORS.length; i++) {
            total += oeth.balanceOf(ACTORS[i]);
        }
    }

    /**
     * @notice Get the total OETH balance of all actors including outsiders
     * @return total Total OETH balance of all actors including outsiders
     */
    function getTotalOethBalanceInclOutsiders()
        internal
        returns (uint256 total)
    {
        total += getTotalOethBalance();
        total += oeth.balanceOf(ADDRESS_OUTSIDER_NONREBASING);
        total += oeth.balanceOf(ADDRESS_OUTSIDER_REBASING);
    }

    /**
     * @notice Get the total WETH balance of all actors
     * @return total Total WETH balance of all actors
     */
    function getTotalWethBalance() internal returns (uint256 total) {
        for (uint256 i = 0; i < ACTORS.length; i++) {
            total += weth.balanceOf(ACTORS[i]);
        }
    }

    /**
     * @notice Get the total WETH balance of all actors including outsiders
     * @return total Total WETH balance of all actors including outsiders
     */
    function getTotalWethBalanceInclOutsiders()
        internal
        returns (uint256 total)
    {
        total += getTotalWethBalance();
        total += weth.balanceOf(ADDRESS_OUTSIDER_NONREBASING);
        total += weth.balanceOf(ADDRESS_OUTSIDER_REBASING);
    }
}
