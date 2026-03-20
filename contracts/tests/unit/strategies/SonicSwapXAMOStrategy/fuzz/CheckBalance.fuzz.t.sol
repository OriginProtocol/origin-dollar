// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicSwapXAMOStrategy_Shared_Test} from
    "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Fuzz_SonicSwapXAMOStrategy_CheckBalance_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    /// @notice checkBalance should include both direct wS balance and LP value
    function testFuzz_checkBalance_includesWSAndLP(
        uint256 wsBalance,
        uint256 depositAmount
    ) public {
        wsBalance = bound(wsBalance, 0, 100_000 ether);
        depositAmount = bound(depositAmount, 1e15, 100_000 ether);

        _seedVaultForSolvency(depositAmount * 10 + 1_000_000 ether);
        _depositAsVault(depositAmount);

        // Deal additional wS directly to strategy
        deal(address(mockWrappedSonic), address(sonicSwapXAMOStrategy), wsBalance);

        uint256 balance = sonicSwapXAMOStrategy.checkBalance(address(mockWrappedSonic));

        // Balance should be at least the direct wS balance
        assertGe(balance, wsBalance, "checkBalance should include direct wS");
        // Balance should be greater than just wsBalance since we also deposited LP
        if (depositAmount > 0) {
            assertGt(balance, wsBalance, "checkBalance should include LP value");
        }
    }
}
