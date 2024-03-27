// SPDX-License-Identifier: MIT
import {FuzzHelper} from "./FuzzHelper.sol";

/**
 * @title Contract containing fuzz tests for global invariants
 * @author Rappie <rappie@perimetersec.io>
 */
contract FuzzGlobal is FuzzHelper {
    /**
     * @notice Run all global invariants fuzz tests
     * @dev We use one single function to run all global invariants fuzz tests.
     * This is done to minize the search space for the fuzzer
     */
    function globalInvariants() public {
        totalWethVsStartingBalance();
        totalOethVsStartingBalance();
        totalYieldVsDonated();
        globalAccounting();
        globalOethVsWethTotalSupply();
        globalVaultBalanceVsOethTotalBalance();
    }

    /**
     * @notice Test total WETH vs starting balance
     */
    function totalWethVsStartingBalance() internal {
        uint256 totalStarting = getTotalWethStartingBalance();
        uint256 totalWeth = getTotalWethBalance();

        if (totalWeth > totalStarting) {
            uint diff = diff(totalStarting, totalWeth);

            lte(
                diff,
                YIELD_TOLERANCE,
                "GLOBAL-01: total WETH should never exceed total WETH starting balance"
            );
        }
    }

    /**
     * @notice Test total OETH vs starting balance
     */
    function totalOethVsStartingBalance() internal {
        uint256 totalStarting = getTotalWethStartingBalance();
        uint256 totalOeth = getTotalOethBalance();

        lte(
            totalOeth,
            totalStarting,
            "GLOBAL-02: total OETH should never exceed total WETH starting balance"
        );
    }

    /**
     * @notice Test total yield vs donated
     */
    function totalYieldVsDonated() internal {
        uint256 diff = diff(totalYield, totalDonated);

        lte(
            diff,
            DONATE_VS_YIELD_TOLERANCE,
            "GLOBAL-03: total yield should be equal to total donated"
        );
    }

    /**
     * @notice Test global accounting
     */
    function globalAccounting() internal {
        uint256 totalStarting = getTotalWethStartingBalanceInclOutsiders();
        uint256 totalWeth = getTotalWethBalanceInclOutsiders();
        uint256 totalOeth = getTotalOethBalanceInclOutsiders();

        // Invariant:
        //    totalStarting - totalDonated = totalWeth + totalOeth - totalYield
        int256 left = int256(totalStarting) - int256(totalDonated);
        int256 right = int256(totalWeth) +
            int256(totalOeth) -
            int256(totalYield);

        uint256 diff = diff(left, right);

        lte(
            diff,
            ACCOUNTING_TOLERANCE,
            "GLOBAL-04: totalStarting - totalDonated = totalWeth + totalOeth - totalYield"
        );
    }

    /**
     * @notice Test OETH total supply vs WETH total supply
     */
    function globalOethVsWethTotalSupply() internal {
        uint256 wethTotalSupply = weth.totalSupply();
        uint256 oethTotalSupply = oeth.totalSupply();

        lte(
            oethTotalSupply,
            wethTotalSupply,
            "GLOBAL-05: OETH total supply should never exceed WETH total supply"
        );
    }

    /**
     * @notice Test vault balance vs total OETH balance
     */
    function globalVaultBalanceVsOethTotalBalance() internal {
        uint256 vaultBalance = weth.balanceOf(address(vault));
        uint256 oethTotalBalance = getTotalOethBalanceInclOutsiders();

        uint256 diff = diff(vaultBalance, oethTotalBalance);

        lte(
            diff,
            VAULT_BALANCE_VS_TOTAL_OETH_TOLERANCE,
            "GLOBAL-06: vault balance should never exceed total OETH balance"
        );
    }
}
