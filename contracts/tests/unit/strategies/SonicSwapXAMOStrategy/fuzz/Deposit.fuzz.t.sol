// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_SonicSwapXAMOStrategy_Deposit_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    /// @notice OS minted should be proportional to the pool's reserve ratio
    function testFuzz_deposit_osProportionalToReserves(uint256 amount, uint256 wsReserves, uint256 osReserves) public {
        amount = bound(amount, 1e15, 100_000 ether);
        wsReserves = bound(wsReserves, 1 ether, 1_000_000 ether);
        // Keep OS/wS ratio reasonable to avoid insolvency (max 3:1)
        osReserves = bound(osReserves, 1 ether, wsReserves * 3);

        // Ensure vault has enough to maintain solvency
        // OS minted = amount * osReserves / wsReserves (can be up to 3x amount)
        uint256 maxOsMinted = (amount * osReserves) / wsReserves;
        _seedVaultForSolvency(maxOsMinted * 10 + amount * 10 + 1_000_000 ether);
        _setupPoolReserves(wsReserves, osReserves);

        uint256 osSupplyBefore = oSonic.totalSupply();
        _depositAsVault(amount);
        uint256 osMinted = oSonic.totalSupply() - osSupplyBefore;

        // OS minted = (amount * osReserves) / wsReserves
        uint256 expectedOs = (amount * osReserves) / wsReserves;
        assertEq(osMinted, expectedOs, "OS minted not proportional to reserves");
    }
}
