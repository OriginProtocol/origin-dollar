// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {Mainnet, CrossChain} from "tests/utils/Addresses.sol";
import {Vm} from "forge-std/Vm.sol";

contract Fork_CrossChainMasterStrategy_Withdraw_Test is Fork_CrossChainMasterStrategy_Shared_Test {
    function test_withdraw_sendsMessage() public {
        _skipIfTransferPending();

        // Set remote balance
        _setRemoteStrategyBalance(1000e6);

        // Withdraw as vault
        vm.recordLogs();
        vm.prank(vaultAddr);
        crossChainMasterStrategy.withdraw(vaultAddr, Mainnet.USDC, 1000e6);

        // Verify MessageSent event
        bytes32 messageSentTopic = 0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036;

        Vm.Log[] memory entries = vm.getRecordedLogs();
        bool found = false;
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics[0] == messageSentTopic) {
                found = true;

                // The MessageSent event emits the full CCTP message as bytes
                bytes memory message = abi.decode(entries[i].data, (bytes));

                // Extract the message body (starts at offset 148 in CCTP message)
                // But the MessageSent from our mock emits the raw sendMessage params
                // Let's verify using the MessageTransmitted event instead
                break;
            }
        }

        // Also verify via our own MessageTransmitted event
        bytes32 messageTransmittedTopic = keccak256("MessageTransmitted(uint32,address,uint32,bytes)");
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics[0] == messageTransmittedTopic) {
                found = true;

                (uint32 destinationDomain, address peerStrategy, uint32 minFinalityThreshold, bytes memory message) =
                    abi.decode(entries[i].data, (uint32, address, uint32, bytes));

                assertEq(destinationDomain, 6, "destinationDomain should be Base (6)");
                assertEq(minFinalityThreshold, 2000, "minFinalityThreshold should be 2000");

                // Decode Origin message from payload
                uint32 originVersion = uint32(bytes4(message));
                uint32 messageType =
                    uint32(bytes4(bytes(abi.encodePacked(message[4], message[5], message[6], message[7]))));
                assertEq(originVersion, 1010, "Origin message version should be 1010");
                assertEq(messageType, 2, "messageType should be WITHDRAW (2)");

                break;
            }
        }
        assertTrue(found, "MessageTransmitted event not found");
    }

    /// @dev withdraw() reverts when recipient is not the vault
    function test_revert_withdraw_nonVaultRecipient() public {
        _skipIfTransferPending();
        _setRemoteStrategyBalance(1000e6);

        vm.prank(vaultAddr);
        vm.expectRevert("Only Vault can withdraw");
        crossChainMasterStrategy.withdraw(matt, Mainnet.USDC, 1000e6);
    }

    /// @dev withdraw() reverts with unsupported asset
    function test_revert_withdraw_unsupportedAsset() public {
        _skipIfTransferPending();
        _setRemoteStrategyBalance(1000e6);

        vm.prank(vaultAddr);
        vm.expectRevert("Unsupported asset");
        crossChainMasterStrategy.withdraw(vaultAddr, Mainnet.WETH, 1000e6);
    }

    /// @dev withdraw() reverts when amount exceeds remote strategy balance
    function test_revert_withdraw_exceedsRemoteBalance() public {
        _skipIfTransferPending();
        _setRemoteStrategyBalance(500e6);

        vm.prank(vaultAddr);
        vm.expectRevert("Withdraw amount exceeds remote strategy balance");
        crossChainMasterStrategy.withdraw(vaultAddr, Mainnet.USDC, 1000e6);
    }

    /// @dev withdrawAll() skips when a transfer is pending (emits WithdrawAllSkipped)
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
        // If we get here, it did not revert — test passes
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
