// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";

// --- External libraries
import {Vm} from "forge-std/Vm.sol";

contract Smoke_CrossChainMasterStrategy_Withdraw_Test is Smoke_CrossChainMasterStrategy_Shared_Test {
    function test_withdraw_sendsMessage() public {
        _skipIfTransferPending();

        // Set remote balance
        _setRemoteStrategyBalance(1000e6);

        // Withdraw as vault
        vm.recordLogs();
        vm.prank(vaultAddr);
        crossChainMasterStrategy.withdraw(vaultAddr, Mainnet.USDC, 1000e6);

        // Verify MessageSent event from the real CCTP MessageTransmitter
        bytes32 messageSentTopic = 0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036;

        Vm.Log[] memory entries = vm.getRecordedLogs();
        bool found = false;
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics[0] == messageSentTopic) {
                found = true;
                break;
            }
        }
        assertTrue(found, "MessageSent event not found");
    }

    /// @dev withdrawAll() skips when a transfer is pending
    function test_withdrawAll_skipsWhenTransferPending() public {
        _skipIfTransferPending();

        // Create a pending transfer via deposit
        vm.prank(matt);
        usdc.transfer(address(crossChainMasterStrategy), 1000e6);
        vm.prank(vaultAddr);
        crossChainMasterStrategy.deposit(Mainnet.USDC, 1000e6);

        assertTrue(crossChainMasterStrategy.isTransferPending(), "Should have pending transfer");

        // withdrawAll should NOT revert, just skip
        vm.prank(vaultAddr);
        crossChainMasterStrategy.withdrawAll();
    }

    /// @dev withdrawAll() is a no-op when remote balance is below minimum
    function test_withdrawAll_noopWhenDustBalance() public {
        _skipIfTransferPending();

        // Set remote balance to dust (< 1 USDC)
        _setRemoteStrategyBalance(1e5);

        // withdrawAll should NOT revert, just silently return
        vm.prank(vaultAddr);
        crossChainMasterStrategy.withdrawAll();

        // Balance should still be dust
        assertEq(crossChainMasterStrategy.remoteStrategyBalance(), 1e5);
    }
}
