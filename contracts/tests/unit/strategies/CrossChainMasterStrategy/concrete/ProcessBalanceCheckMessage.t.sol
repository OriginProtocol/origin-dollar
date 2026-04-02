// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {ICrossChainMasterStrategy} from "contracts/interfaces/strategies/ICrossChainMasterStrategy.sol";
import {CrossChainStrategyHelper} from "contracts/strategies/crosschain/CrossChainStrategyHelper.sol";

contract Unit_Concrete_CrossChainMasterStrategy_ProcessBalanceCheckMessage_Test is
    Unit_CrossChainMasterStrategy_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- PROCESS BALANCE CHECK MESSAGE
    //////////////////////////////////////////////////////

    function test_processBalanceCheck_confirmsDeposit() public {
        uint256 amount = 1000e6;
        _depositAsVault(amount);

        // Verify pending state
        assertTrue(crossChainMasterStrategy.isTransferPending());
        assertEq(crossChainMasterStrategy.pendingAmount(), amount);

        // Send balance check confirmation
        uint64 nonce = crossChainMasterStrategy.lastTransferNonce();
        _sendBalanceCheck(nonce, amount, true, block.timestamp);

        // Verify confirmed state
        assertFalse(crossChainMasterStrategy.isTransferPending());
        assertEq(crossChainMasterStrategy.pendingAmount(), 0);
        assertEq(crossChainMasterStrategy.remoteStrategyBalance(), amount);
    }

    function test_processBalanceCheck_emitsRemoteStrategyBalanceUpdated() public {
        uint256 amount = 500e6;
        _depositAsVault(amount);
        uint64 nonce = crossChainMasterStrategy.lastTransferNonce();

        vm.expectEmit(true, true, true, true);
        emit ICrossChainMasterStrategy.RemoteStrategyBalanceUpdated(amount);

        _sendBalanceCheck(nonce, amount, true, block.timestamp);
    }

    function test_processBalanceCheck_ignoresOutdatedNonce() public {
        _completeDepositFlow(500e6);

        // Send a balance check with nonce 0 (outdated)
        _sendBalanceCheck(0, 9999e6, false, block.timestamp);

        // Balance should not change (nonce 0 != lastTransferNonce which is 1)
        assertEq(crossChainMasterStrategy.remoteStrategyBalance(), 500e6);
    }

    function test_processBalanceCheck_ignoresNonConfirmation_whenTransferPending() public {
        // Create pending deposit
        _depositAsVault(1000e6);
        uint64 nonce = crossChainMasterStrategy.lastTransferNonce();

        // Send non-confirmation balance check (transferConfirmation = false)
        vm.expectEmit(true, true, true, true);
        emit ICrossChainMasterStrategy.BalanceCheckIgnored(nonce, block.timestamp, false);

        _sendBalanceCheck(nonce, 2000e6, false, block.timestamp);

        // Should still be pending
        assertTrue(crossChainMasterStrategy.isTransferPending());
        assertEq(crossChainMasterStrategy.pendingAmount(), 1000e6);
    }

    function test_processBalanceCheck_ignoresTooOldMessage() public {
        // Complete a flow first so we have a valid nonce
        _completeDepositFlow(500e6);

        uint64 nonce = crossChainMasterStrategy.lastTransferNonce();

        // Send a balance check with old timestamp (more than 1 day ago)
        uint256 oldTimestamp = block.timestamp - 1 days - 1;

        vm.expectEmit(true, true, true, true);
        emit ICrossChainMasterStrategy.BalanceCheckIgnored(nonce, oldTimestamp, true);

        _sendBalanceCheck(nonce, 9999e6, false, oldTimestamp);

        // Balance should not change
        assertEq(crossChainMasterStrategy.remoteStrategyBalance(), 500e6);
    }

    function test_processBalanceCheck_updatesBalance_whenNoTransferPending() public {
        // Complete a flow first
        _completeDepositFlow(500e6);
        assertEq(crossChainMasterStrategy.remoteStrategyBalance(), 500e6);

        uint64 nonce = crossChainMasterStrategy.lastTransferNonce();

        // Send a fresh balance check (non-confirmation, no transfer pending)
        _sendBalanceCheck(nonce, 600e6, false, block.timestamp);

        assertEq(crossChainMasterStrategy.remoteStrategyBalance(), 600e6);
    }

    function test_processBalanceCheck_acceptsExactTimestampBoundary() public {
        _completeDepositFlow(500e6);
        uint64 nonce = crossChainMasterStrategy.lastTransferNonce();

        // Exactly at the boundary: block.timestamp == timestamp + MAX_BALANCE_CHECK_AGE
        uint256 boundaryTimestamp = block.timestamp - 1 days;
        _sendBalanceCheck(nonce, 700e6, false, boundaryTimestamp);

        // Should be accepted (not too old at exact boundary)
        assertEq(crossChainMasterStrategy.remoteStrategyBalance(), 700e6);
    }

    function test_processBalanceCheck_confirmsWithdraw() public {
        // Set up remote balance
        _completeDepositFlow(5000e6);

        // Initiate withdrawal
        vm.prank(address(ousdVault));
        crossChainMasterStrategy.withdraw(address(ousdVault), address(mockUsdc), 2000e6);

        assertTrue(crossChainMasterStrategy.isTransferPending());

        // Confirm withdrawal with updated balance
        uint64 nonce = crossChainMasterStrategy.lastTransferNonce();
        _sendBalanceCheck(nonce, 3000e6, true, block.timestamp);

        assertFalse(crossChainMasterStrategy.isTransferPending());
        assertEq(crossChainMasterStrategy.remoteStrategyBalance(), 3000e6);
    }
}
