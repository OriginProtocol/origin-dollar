// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainRemoteStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {CrossChainRemoteStrategy} from "contracts/strategies/crosschain/CrossChainRemoteStrategy.sol";
import {CrossChainStrategyHelper} from "contracts/strategies/crosschain/CrossChainStrategyHelper.sol";

contract Unit_Concrete_CrossChainRemoteStrategy_ProcessWithdrawMessage_Test is
    Unit_CrossChainRemoteStrategy_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- PROCESS WITHDRAW MESSAGE
    //////////////////////////////////////////////////////

    function setUp() public override {
        super.setUp();
        // Pre-deposit 5000 USDC into the 4626 vault so we have funds to withdraw
        _depositAsGovernor(5000e6);
    }

    function test_processWithdrawMessage_withdrawsAndSendsTokens() public {
        uint256 withdrawAmount = 1000e6;
        uint64 nonce = crossChainRemoteStrategy.lastTransferNonce() + 1;

        // Send withdraw message
        _sendWithdrawMessage(nonce, withdrawAmount);

        // Nonce should be processed
        assertTrue(crossChainRemoteStrategy.isNonceProcessed(nonce));

        // Tokens should have been sent via CCTP (moved to transmitter/messenger)
        // The balance in the 4626 should decrease
        uint256 remainingBalance = crossChainRemoteStrategy.checkBalance(address(mockUsdc));
        assertEq(remainingBalance, 5000e6 - withdrawAmount);
    }

    function test_processWithdrawMessage_marksNonceProcessed() public {
        uint64 nonce = crossChainRemoteStrategy.lastTransferNonce() + 1;

        _sendWithdrawMessage(nonce, 500e6);

        assertTrue(crossChainRemoteStrategy.isNonceProcessed(nonce));
        assertEq(crossChainRemoteStrategy.lastTransferNonce(), nonce);
    }

    function test_processWithdrawMessage_sendsBalanceCheckWithTokens_whenSufficientFunds() public {
        uint256 withdrawAmount = 2000e6;
        uint64 nonce = crossChainRemoteStrategy.lastTransferNonce() + 1;

        uint256 messagesLenBefore = cctpMessageTransmitterMock.getMessagesLength();

        _sendWithdrawMessage(nonce, withdrawAmount);

        // Should have queued a token transfer message (burn message with balance check)
        assertGt(cctpMessageTransmitterMock.getMessagesLength(), messagesLenBefore);
    }

    function test_processWithdrawMessage_emitsWithdrawalFailed_whenInsufficientFunds() public {
        // Withdraw all from 4626 first, leaving minimal funds
        vm.prank(governor);
        crossChainRemoteStrategy.withdrawAll();

        // Remove USDC from strategy to simulate empty state
        uint256 bal = mockUsdc.balanceOf(address(crossChainRemoteStrategy));
        // We can't easily remove USDC from the contract, but we can try to withdraw
        // more than what's available after a withdrawal failure

        // Deposit a small amount back
        _mintUsdc(address(crossChainRemoteStrategy), 10e6);
        vm.prank(governor);
        crossChainRemoteStrategy.deposit(address(mockUsdc), 10e6);

        uint64 nonce = crossChainRemoteStrategy.lastTransferNonce() + 1;

        // Request more than available (the 4626 vault withdraw will fail for the excess)
        // Since we have ~10 USDC and request 1000, the _withdraw try-catch will handle it
        // but usdcBalance will be < withdrawAmount
        // Actually, let's simulate a case where funds are insufficient more directly
        // Withdraw everything from 4626 first
        vm.prank(governor);
        crossChainRemoteStrategy.withdrawAll();
        // Now contract has USDC but 4626 is empty

        // Burn most of the USDC by transferring it away (simulate it being spent)
        // We need a scenario where strategy has less USDC than the withdraw request
        uint256 currentBal = mockUsdc.balanceOf(address(crossChainRemoteStrategy));
        if (currentBal > 0) {
            // Transfer USDC away from strategy to create insufficient balance scenario
            vm.prank(address(crossChainRemoteStrategy));
            mockUsdc.transfer(alice, currentBal);
        }

        // Now try to process a withdraw message with insufficient funds
        _mintUsdc(address(crossChainRemoteStrategy), 5e5); // Only 0.5 USDC (below MIN)

        vm.expectEmit(true, true, true, true);
        emit CrossChainRemoteStrategy.WithdrawalFailed(1000e6, 5e5);

        _sendWithdrawMessage(nonce, 1000e6);
    }

    function test_processWithdrawMessage_usesContractBalance_whenAvailable() public {
        // Withdraw from 4626 to have USDC on contract
        vm.prank(governor);
        crossChainRemoteStrategy.withdraw(address(crossChainRemoteStrategy), address(mockUsdc), 2000e6);

        // Now contract has 2000 USDC loose + 3000 in 4626
        assertEq(mockUsdc.balanceOf(address(crossChainRemoteStrategy)), 2000e6);

        uint64 nonce = crossChainRemoteStrategy.lastTransferNonce() + 1;

        // Request 1500 - should use contract USDC without touching 4626
        _sendWithdrawMessage(nonce, 1500e6);

        assertTrue(crossChainRemoteStrategy.isNonceProcessed(nonce));
        // Contract should have 500 USDC remaining (2000 - 1500)
        assertEq(mockUsdc.balanceOf(address(crossChainRemoteStrategy)), 500e6);
    }

    function test_processWithdrawMessage_withdrawsFromERC4626_whenContractBalanceInsufficient() public {
        // Strategy has 0 loose USDC, 5000 in 4626
        assertEq(mockUsdc.balanceOf(address(crossChainRemoteStrategy)), 0);

        uint64 nonce = crossChainRemoteStrategy.lastTransferNonce() + 1;

        _sendWithdrawMessage(nonce, 1000e6);

        assertTrue(crossChainRemoteStrategy.isNonceProcessed(nonce));
        // After withdrawing 1000 from 4626, it's sent via CCTP
        // Remaining should be 4000 in 4626
        assertEq(crossChainRemoteStrategy.checkBalance(address(mockUsdc)), 4000e6);
    }

    function test_processWithdrawMessage_handleReceiveMessage_unknownType() public {
        // Send a balance check message (type 3) which remote doesn't handle
        bytes memory payload = CrossChainStrategyHelper.encodeBalanceCheckMessage(1, 100e6, false, block.timestamp);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Unknown message type");
        crossChainRemoteStrategy.handleReceiveFinalizedMessage(
            0, bytes32(uint256(uint160(peerStrategy))), 2000, payload
        );
    }

    function test_processWithdrawMessage_multipleSequentialWithdrawals() public {
        uint64 nonce1 = crossChainRemoteStrategy.lastTransferNonce() + 1;
        _sendWithdrawMessage(nonce1, 1000e6);

        uint64 nonce2 = crossChainRemoteStrategy.lastTransferNonce() + 1;
        _sendWithdrawMessage(nonce2, 500e6);

        assertEq(crossChainRemoteStrategy.checkBalance(address(mockUsdc)), 5000e6 - 1000e6 - 500e6);
        assertTrue(crossChainRemoteStrategy.isNonceProcessed(nonce1));
        assertTrue(crossChainRemoteStrategy.isNonceProcessed(nonce2));
    }
}
