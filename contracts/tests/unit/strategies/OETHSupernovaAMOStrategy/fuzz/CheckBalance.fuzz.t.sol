// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_OETHSupernovaAMOStrategy_CheckBalance_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    /// @notice checkBalance should include both direct WETH balance and LP value
    function testFuzz_checkBalance_includesWETHAndLP(uint256 wethBalance, uint256 depositAmount) public {
        wethBalance = bound(wethBalance, 0, 100_000 ether);
        depositAmount = bound(depositAmount, 1e15, 100_000 ether);

        _seedVaultForSolvency(depositAmount * 10 + 1_000_000 ether);
        _depositAsVault(depositAmount);

        // Deal additional WETH directly to strategy
        deal(address(mockWeth), address(oethSupernovaAMOStrategy), wethBalance);

        uint256 balance = oethSupernovaAMOStrategy.checkBalance(address(mockWeth));

        // Balance should be at least the direct WETH balance
        assertGe(balance, wethBalance, "checkBalance should include direct WETH");
        // Balance should be greater than just wethBalance since we also deposited LP
        if (depositAmount > 0) {
            assertGt(balance, wethBalance, "checkBalance should include LP value");
        }
    }
}
