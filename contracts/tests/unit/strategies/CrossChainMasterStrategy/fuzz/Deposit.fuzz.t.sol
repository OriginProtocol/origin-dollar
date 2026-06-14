// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_Fuzz_CrossChainMasterStrategy_Deposit_Test is Unit_CrossChainMasterStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- DEPOSIT (FUZZ)
    //////////////////////////////////////////////////////

    /// @notice Pending amount always equals the deposited amount
    function testFuzz_deposit_correctPendingAmount(uint256 amount) public {
        amount = bound(amount, 1e6, 10_000_000e6);
        _mintUsdc(address(crossChainMasterStrategy), amount);

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.deposit(address(mockUsdc), amount);

        assertEq(crossChainMasterStrategy.pendingAmount(), amount);
    }

    /// @notice All USDC leaves the strategy after deposit
    function testFuzz_deposit_bridgesExactAmount(uint256 amount) public {
        amount = bound(amount, 1e6, 10_000_000e6);
        _mintUsdc(address(crossChainMasterStrategy), amount);

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.deposit(address(mockUsdc), amount);

        assertEq(mockUsdc.balanceOf(address(crossChainMasterStrategy)), 0);
    }

    /// @notice Nonce increments by exactly 1 on each deposit
    function testFuzz_deposit_incrementsNonce(uint256 amount) public {
        amount = bound(amount, 1e6, 10_000_000e6);
        _mintUsdc(address(crossChainMasterStrategy), amount);

        uint64 nonceBefore = crossChainMasterStrategy.lastTransferNonce();

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.deposit(address(mockUsdc), amount);

        assertEq(crossChainMasterStrategy.lastTransferNonce(), nonceBefore + 1);
    }

    /// @notice checkBalance reflects pending amount correctly during deposit
    function testFuzz_deposit_checkBalanceIncludesPending(uint256 amount) public {
        amount = bound(amount, 1e6, 10_000_000e6);
        _mintUsdc(address(crossChainMasterStrategy), amount);

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.deposit(address(mockUsdc), amount);

        assertEq(crossChainMasterStrategy.checkBalance(address(mockUsdc)), amount);
    }
}
