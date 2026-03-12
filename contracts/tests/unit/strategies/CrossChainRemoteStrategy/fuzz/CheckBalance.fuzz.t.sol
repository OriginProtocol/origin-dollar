// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainRemoteStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_Fuzz_CrossChainRemoteStrategy_CheckBalance_Test is Unit_CrossChainRemoteStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- CHECK BALANCE (FUZZ)
    //////////////////////////////////////////////////////

    /// @notice checkBalance always equals 4626 balance + contract USDC balance
    function testFuzz_checkBalance_sumsCorrectly(uint256 deposited, uint256 onContract) public {
        deposited = bound(deposited, 1, 5_000_000e6);
        onContract = bound(onContract, 0, 5_000_000e6);

        // Deposit into 4626
        _depositAsGovernor(deposited);

        // Add loose USDC to contract
        if (onContract > 0) {
            _mintUsdc(address(crossChainRemoteStrategy), onContract);
        }

        uint256 balance = crossChainRemoteStrategy.checkBalance(address(mockUsdc));
        assertEq(balance, deposited + onContract);
    }

    /// @notice checkBalance after partial withdrawal reflects correct remaining
    function testFuzz_checkBalance_afterPartialWithdraw(uint256 depositAmount, uint256 withdrawFraction) public {
        depositAmount = bound(depositAmount, 2, 5_000_000e6);
        withdrawFraction = bound(withdrawFraction, 1, depositAmount - 1);

        _depositAsGovernor(depositAmount);

        vm.prank(governor);
        crossChainRemoteStrategy.withdraw(address(crossChainRemoteStrategy), address(mockUsdc), withdrawFraction);

        // After withdraw, USDC is back on contract + remainder in 4626
        uint256 balance = crossChainRemoteStrategy.checkBalance(address(mockUsdc));
        assertEq(balance, depositAmount);
    }

    /// @notice checkBalance returns zero when nothing deposited and no USDC on contract
    function testFuzz_checkBalance_zeroWhenEmpty(uint256 dummyInput) public view {
        // Fuzz input is unused - just proving the property holds regardless
        dummyInput; // silence warning
        assertEq(crossChainRemoteStrategy.checkBalance(address(mockUsdc)), 0);
    }
}
