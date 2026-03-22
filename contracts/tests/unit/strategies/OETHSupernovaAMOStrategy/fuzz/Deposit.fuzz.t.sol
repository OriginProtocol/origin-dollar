// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_OETHSupernovaAMOStrategy_Deposit_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    /// @notice OETH minted should be proportional to the pool's reserve ratio
    function testFuzz_deposit_oethProportionalToReserves(uint256 amount, uint256 wethReserves, uint256 oethReserves)
        public
    {
        amount = bound(amount, 1e15, 100_000 ether);
        wethReserves = bound(wethReserves, 1 ether, 1_000_000 ether);
        // Keep OETH/WETH ratio reasonable to avoid insolvency (max 3:1)
        oethReserves = bound(oethReserves, 1 ether, wethReserves * 3);

        // Ensure vault has enough to maintain solvency
        // OETH minted = amount * oethReserves / wethReserves (can be up to 3x amount)
        uint256 maxOethMinted = (amount * oethReserves) / wethReserves;
        _seedVaultForSolvency(maxOethMinted * 10 + amount * 10 + 1_000_000 ether);
        _setupPoolReserves(wethReserves, oethReserves);

        uint256 oethSupplyBefore = oeth.totalSupply();
        _depositAsVault(amount);
        uint256 oethMinted = oeth.totalSupply() - oethSupplyBefore;

        // OETH minted = (amount * oethReserves) / wethReserves
        uint256 expectedOeth = (amount * oethReserves) / wethReserves;
        assertEq(oethMinted, expectedOeth, "OETH minted not proportional to reserves");
    }
}
