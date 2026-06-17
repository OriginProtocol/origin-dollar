// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";

contract Smoke_CrossChainMasterStrategy_Deposit_Test is Smoke_CrossChainMasterStrategy_Shared_Test {
    function test_deposit_bridgesUsdc() public {
        _skipIfTransferPending();

        // Transfer USDC to strategy
        vm.prank(matt);
        usdc.transfer(address(crossChainMasterStrategy), 1000e6);

        uint256 usdcBalanceBefore = usdc.balanceOf(address(crossChainMasterStrategy));
        uint256 checkBalanceBefore = crossChainMasterStrategy.checkBalance(Mainnet.USDC);

        // Deposit as vault
        vm.prank(vaultAddr);
        crossChainMasterStrategy.deposit(Mainnet.USDC, 1000e6);

        // Assert USDC balance decreased
        uint256 usdcBalanceAfter = usdc.balanceOf(address(crossChainMasterStrategy));
        assertEq(usdcBalanceAfter, usdcBalanceBefore - 1000e6, "USDC balance should decrease by 1000");

        // Assert checkBalance unchanged (pendingAmount compensates)
        uint256 checkBalanceAfter = crossChainMasterStrategy.checkBalance(Mainnet.USDC);
        assertEq(checkBalanceAfter, checkBalanceBefore, "checkBalance should be unchanged");

        // Assert pendingAmount
        assertEq(crossChainMasterStrategy.pendingAmount(), 1000e6, "pendingAmount should be 1000 USDC");
    }
}
