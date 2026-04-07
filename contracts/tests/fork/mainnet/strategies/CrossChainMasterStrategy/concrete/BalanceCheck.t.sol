// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

contract Fork_CrossChainMasterStrategy_BalanceCheck_Test is Fork_CrossChainMasterStrategy_Shared_Test {
    function test_balanceCheck_updatesRemoteBalance() public {
        _skipIfTransferPending();

        uint64 lastNonce = crossChainMasterStrategy.lastTransferNonce();

        // Replace transmitter with mock
        _replaceMessageTransmitter();

        // Build balance check message
        bytes memory balancePayload = _encodeBalanceCheckMessage(lastNonce, 12345e6, false, block.timestamp);
        bytes memory message =
            _encodeCCTPMessage(6, address(crossChainMasterStrategy), address(crossChainMasterStrategy), balancePayload);

        // Relay
        vm.prank(relayer);
        crossChainMasterStrategy.relay(message, "");

        assertEq(crossChainMasterStrategy.remoteStrategyBalance(), 12345e6, "remoteStrategyBalance should be updated");
    }

    function test_balanceCheck_confirmsPendingDeposit() public {
        _skipIfTransferPending();

        // Do a deposit first
        vm.prank(matt);
        usdc.transfer(address(crossChainMasterStrategy), 1000e6);

        vm.prank(vaultAddr);
        crossChainMasterStrategy.deposit(Mainnet.USDC, 1000e6);

        uint64 lastNonce = crossChainMasterStrategy.lastTransferNonce();

        // Replace transmitter
        _replaceMessageTransmitter();

        // Build balance check with transferConfirmation=true
        bytes memory balancePayload = _encodeBalanceCheckMessage(lastNonce, 10000e6, true, block.timestamp);
        bytes memory message =
            _encodeCCTPMessage(6, address(crossChainMasterStrategy), address(crossChainMasterStrategy), balancePayload);

        // Relay
        vm.prank(relayer);
        crossChainMasterStrategy.relay(message, "");

        assertEq(
            crossChainMasterStrategy.remoteStrategyBalance(), 10000e6, "remoteStrategyBalance should be 10000 USDC"
        );
        assertEq(crossChainMasterStrategy.pendingAmount(), 0, "pendingAmount should be cleared");
    }

    function test_balanceCheck_ignoresDuringPendingWithdrawal() public {
        _skipIfTransferPending();

        // Set remote balance and withdraw
        _setRemoteStrategyBalance(1000e6);

        uint256 remoteBalanceBefore = crossChainMasterStrategy.remoteStrategyBalance();

        vm.prank(vaultAddr);
        crossChainMasterStrategy.withdraw(vaultAddr, Mainnet.USDC, 1000e6);

        uint64 lastNonce = crossChainMasterStrategy.lastTransferNonce();

        // Replace transmitter
        _replaceMessageTransmitter();

        // Build balance check with transferConfirmation=false (not a confirmation)
        bytes memory balancePayload = _encodeBalanceCheckMessage(lastNonce, 10000e6, false, block.timestamp);
        bytes memory message =
            _encodeCCTPMessage(6, address(crossChainMasterStrategy), address(crossChainMasterStrategy), balancePayload);

        // Relay
        vm.prank(relayer);
        crossChainMasterStrategy.relay(message, "");

        // Balance should be unchanged — message ignored during pending withdrawal
        assertEq(
            crossChainMasterStrategy.remoteStrategyBalance(),
            remoteBalanceBefore,
            "remoteStrategyBalance should be unchanged"
        );
    }

    function test_balanceCheck_ignoresOlderNonce() public {
        _skipIfTransferPending();

        uint64 nonceBefore = crossChainMasterStrategy.lastTransferNonce();

        // Do a deposit (increments nonce)
        vm.prank(matt);
        usdc.transfer(address(crossChainMasterStrategy), 1000e6);
        vm.prank(vaultAddr);
        crossChainMasterStrategy.deposit(Mainnet.USDC, 1000e6);

        uint256 remoteBalanceBefore = crossChainMasterStrategy.remoteStrategyBalance();

        // Replace transmitter
        _replaceMessageTransmitter();

        // Build balance check with OLD nonce (before deposit)
        bytes memory balancePayload = _encodeBalanceCheckMessage(nonceBefore, 123244e6, false, block.timestamp);
        bytes memory message =
            _encodeCCTPMessage(6, address(crossChainMasterStrategy), address(crossChainMasterStrategy), balancePayload);

        // Relay
        vm.prank(relayer);
        crossChainMasterStrategy.relay(message, "");

        // Balance should be unchanged
        assertEq(
            crossChainMasterStrategy.remoteStrategyBalance(),
            remoteBalanceBefore,
            "remoteStrategyBalance should be unchanged with old nonce"
        );
    }

    function test_balanceCheck_ignoresHigherNonce() public {
        _skipIfTransferPending();

        uint64 lastNonce = crossChainMasterStrategy.lastTransferNonce();
        uint256 remoteBalanceBefore = crossChainMasterStrategy.remoteStrategyBalance();

        // Replace transmitter
        _replaceMessageTransmitter();

        // Build balance check with nonce + 2 (higher than expected)
        bytes memory balancePayload = _encodeBalanceCheckMessage(lastNonce + 2, 123244e6, false, block.timestamp);
        bytes memory message =
            _encodeCCTPMessage(6, address(crossChainMasterStrategy), address(crossChainMasterStrategy), balancePayload);

        // Relay
        vm.prank(relayer);
        crossChainMasterStrategy.relay(message, "");

        // Balance should be unchanged
        assertEq(
            crossChainMasterStrategy.remoteStrategyBalance(),
            remoteBalanceBefore,
            "remoteStrategyBalance should be unchanged with higher nonce"
        );
    }

    /// @dev Balance check with a timestamp older than MAX_BALANCE_CHECK_AGE (1 day) is ignored
    function test_balanceCheck_ignoresTooOldTimestamp() public {
        _skipIfTransferPending();

        uint64 lastNonce = crossChainMasterStrategy.lastTransferNonce();
        uint256 remoteBalanceBefore = crossChainMasterStrategy.remoteStrategyBalance();

        // Replace transmitter
        _replaceMessageTransmitter();

        // Build balance check with a timestamp > 1 day in the past
        uint256 oldTimestamp = block.timestamp - 1 days - 1;
        bytes memory balancePayload = _encodeBalanceCheckMessage(lastNonce, 99999e6, false, oldTimestamp);
        bytes memory message =
            _encodeCCTPMessage(6, address(crossChainMasterStrategy), address(crossChainMasterStrategy), balancePayload);

        // Relay
        vm.prank(relayer);
        crossChainMasterStrategy.relay(message, "");

        // Balance should be unchanged — message too old
        assertEq(
            crossChainMasterStrategy.remoteStrategyBalance(),
            remoteBalanceBefore,
            "remoteStrategyBalance should be unchanged for stale balance check"
        );
    }
}
