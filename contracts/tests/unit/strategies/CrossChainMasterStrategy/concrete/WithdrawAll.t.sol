// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {CrossChainMasterStrategy} from "contracts/strategies/crosschain/CrossChainMasterStrategy.sol";

contract Unit_Concrete_CrossChainMasterStrategy_WithdrawAll_Test is Unit_CrossChainMasterStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- WITHDRAWALL
    //////////////////////////////////////////////////////

    function test_withdrawAll_withdrawsFullRemoteBalance() public {
        _completeDepositFlow(5000e6);

        uint256 remoteBalance = crossChainMasterStrategy.remoteStrategyBalance();
        assertGt(remoteBalance, 0);

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.withdrawAll();

        // Should have queued a withdraw message
        assertGt(cctpMessageTransmitterMock.getMessagesLength(), 0);
        assertTrue(crossChainMasterStrategy.isTransferPending());
    }

    function test_withdrawAll_emitsWithdrawAllSkipped_whenPending() public {
        // Create a pending deposit
        _depositAsVault(1000e6);
        assertTrue(crossChainMasterStrategy.isTransferPending());

        vm.expectEmit(true, true, true, true);
        emit CrossChainMasterStrategy.WithdrawAllSkipped();

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.withdrawAll();
    }

    function test_withdrawAll_doesNothing_whenRemoteBalanceBelowMin() public {
        // No deposit done, remoteStrategyBalance == 0
        assertEq(crossChainMasterStrategy.remoteStrategyBalance(), 0);

        uint256 messagesLenBefore = cctpMessageTransmitterMock.getMessagesLength();

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.withdrawAll();

        // No message should be queued
        assertEq(cctpMessageTransmitterMock.getMessagesLength(), messagesLenBefore);
    }

    function test_withdrawAll_capsAtMaxTransferAmount() public {
        // Set up a very large remote balance by completing a deposit and then
        // updating the balance check to a large amount
        _completeDepositFlow(1000e6);

        // Send a balance check with a very large balance (> MAX_TRANSFER_AMOUNT)
        uint64 nonce = crossChainMasterStrategy.lastTransferNonce();
        uint256 largeBalance = 15_000_000e6; // 15M > 10M max
        _sendBalanceCheck(nonce, largeBalance, false, block.timestamp);

        assertEq(crossChainMasterStrategy.remoteStrategyBalance(), largeBalance);

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.withdrawAll();

        // Should still succeed (caps to MAX_TRANSFER_AMOUNT)
        assertTrue(crossChainMasterStrategy.isTransferPending());
    }

    function test_withdrawAll_calledByGovernor() public {
        _completeDepositFlow(5000e6);

        vm.prank(governor);
        crossChainMasterStrategy.withdrawAll();

        assertTrue(crossChainMasterStrategy.isTransferPending());
    }

    function test_withdrawAll_RevertWhen_calledByNonVaultOrGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault or Governor");
        crossChainMasterStrategy.withdrawAll();
    }
}
