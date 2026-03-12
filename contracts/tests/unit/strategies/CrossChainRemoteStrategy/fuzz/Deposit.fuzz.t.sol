// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainRemoteStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_Fuzz_CrossChainRemoteStrategy_Deposit_Test is Unit_CrossChainRemoteStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- DEPOSIT (FUZZ)
    //////////////////////////////////////////////////////

    /// @notice Deposited amount matches 4626 vault balance (1:1 for mock vault)
    function testFuzz_deposit_correctShareBalance(uint256 amount) public {
        amount = bound(amount, 1, 10_000_000e6);
        _mintUsdc(address(crossChainRemoteStrategy), amount);

        vm.prank(governor);
        crossChainRemoteStrategy.deposit(address(mockUsdc), amount);

        assertEq(mockERC4626Vault.balanceOf(address(crossChainRemoteStrategy)), amount);
    }

    /// @notice All USDC leaves the strategy after deposit
    function testFuzz_deposit_noUsdcRemainsOnContract(uint256 amount) public {
        amount = bound(amount, 1, 10_000_000e6);
        _mintUsdc(address(crossChainRemoteStrategy), amount);

        vm.prank(governor);
        crossChainRemoteStrategy.deposit(address(mockUsdc), amount);

        assertEq(mockUsdc.balanceOf(address(crossChainRemoteStrategy)), 0);
    }

    /// @notice checkBalance reports the full deposited amount
    function testFuzz_deposit_checkBalanceMatchesDeposit(uint256 amount) public {
        amount = bound(amount, 1, 10_000_000e6);
        _mintUsdc(address(crossChainRemoteStrategy), amount);

        vm.prank(governor);
        crossChainRemoteStrategy.deposit(address(mockUsdc), amount);

        assertEq(crossChainRemoteStrategy.checkBalance(address(mockUsdc)), amount);
    }

    /// @notice Deposit and full withdrawal returns all USDC
    function testFuzz_deposit_roundTripPreservesAmount(uint256 amount) public {
        amount = bound(amount, 1, 10_000_000e6);
        _mintUsdc(address(crossChainRemoteStrategy), amount);

        vm.startPrank(governor);
        crossChainRemoteStrategy.deposit(address(mockUsdc), amount);
        crossChainRemoteStrategy.withdrawAll();
        vm.stopPrank();

        assertEq(mockUsdc.balanceOf(address(crossChainRemoteStrategy)), amount);
        assertEq(mockERC4626Vault.balanceOf(address(crossChainRemoteStrategy)), 0);
    }
}
