// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {ICrossChainMasterStrategy} from "contracts/interfaces/strategies/ICrossChainMasterStrategy.sol";

contract Unit_Concrete_CrossChainMasterStrategy_Withdraw_Test is Unit_CrossChainMasterStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- WITHDRAW
    //////////////////////////////////////////////////////

    function setUp() public override {
        super.setUp();
        // Set up state with remoteStrategyBalance > 0
        _completeDepositFlow(5000e6);
    }

    function test_withdraw_sendsCCTPMessage() public {
        uint256 amount = 1000e6;

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.withdraw(address(ousdVault), address(mockUsdc), amount);

        // Verify message was queued in transmitter mock
        assertGt(cctpMessageTransmitterMock.getMessagesLength(), 0);
    }

    function test_withdraw_incrementsNonce() public {
        uint64 nonceBefore = crossChainMasterStrategy.lastTransferNonce();

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.withdraw(address(ousdVault), address(mockUsdc), 1000e6);

        assertEq(crossChainMasterStrategy.lastTransferNonce(), nonceBefore + 1);
    }

    function test_withdraw_emitsWithdrawRequestedEvent() public {
        uint256 amount = 1000e6;

        vm.expectEmit(true, true, true, true);
        emit ICrossChainMasterStrategy.WithdrawRequested(address(mockUsdc), amount);

        vm.prank(address(ousdVault));
        crossChainMasterStrategy.withdraw(address(ousdVault), address(mockUsdc), amount);
    }

    function test_withdraw_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        crossChainMasterStrategy.withdraw(address(ousdVault), address(mockUsdc), 100e6);
    }

    function test_withdraw_RevertWhen_wrongAsset() public {
        vm.prank(address(ousdVault));
        vm.expectRevert("Unsupported asset");
        crossChainMasterStrategy.withdraw(address(ousdVault), address(0xdead), 100e6);
    }

    function test_withdraw_RevertWhen_recipientNotVault() public {
        vm.prank(address(ousdVault));
        vm.expectRevert("Only Vault can withdraw");
        crossChainMasterStrategy.withdraw(alice, address(mockUsdc), 100e6);
    }

    function test_withdraw_RevertWhen_amountTooSmall() public {
        vm.prank(address(ousdVault));
        vm.expectRevert("Withdraw amount too small");
        crossChainMasterStrategy.withdraw(address(ousdVault), address(mockUsdc), 1e6 - 1);
    }

    function test_withdraw_RevertWhen_amountExceedsRemoteBalance() public {
        uint256 remoteBalance = crossChainMasterStrategy.remoteStrategyBalance();

        vm.prank(address(ousdVault));
        vm.expectRevert("Withdraw amount exceeds remote strategy balance");
        crossChainMasterStrategy.withdraw(address(ousdVault), address(mockUsdc), remoteBalance + 1);
    }

    function test_withdraw_RevertWhen_amountExceedsMaxTransfer() public {
        // setUp already deposited 5000e6 (remoteStrategyBalance = 5000e6)
        // We need remoteStrategyBalance > MAX_TRANSFER_AMOUNT (10_000_000e6)
        // Deposit more and send balance check with cumulative balance
        _mintUsdc(address(crossChainMasterStrategy), 5_000_000e6);
        vm.prank(address(ousdVault));
        crossChainMasterStrategy.deposit(address(mockUsdc), 5_000_000e6);

        uint64 nonce = crossChainMasterStrategy.lastTransferNonce();
        _sendBalanceCheck(nonce, 5_005_000e6, true, block.timestamp);

        _mintUsdc(address(crossChainMasterStrategy), 5_000_000e6);
        vm.prank(address(ousdVault));
        crossChainMasterStrategy.deposit(address(mockUsdc), 5_000_000e6);

        nonce = crossChainMasterStrategy.lastTransferNonce();
        _sendBalanceCheck(nonce, 10_005_000e6, true, block.timestamp);

        assertGt(crossChainMasterStrategy.remoteStrategyBalance(), 10_000_001e6);

        vm.prank(address(ousdVault));
        vm.expectRevert("Withdraw amount exceeds max transfer amount");
        crossChainMasterStrategy.withdraw(address(ousdVault), address(mockUsdc), 10_000_001e6);
    }

    function test_withdraw_RevertWhen_pendingTransfer() public {
        // First withdraw creates a pending transfer
        vm.prank(address(ousdVault));
        crossChainMasterStrategy.withdraw(address(ousdVault), address(mockUsdc), 1000e6);

        // Second withdraw should revert
        vm.prank(address(ousdVault));
        vm.expectRevert("Pending token transfer");
        crossChainMasterStrategy.withdraw(address(ousdVault), address(mockUsdc), 1000e6);
    }
}
