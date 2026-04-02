// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_CrossChainRemoteStrategyBase_Shared_Test} from "../shared/Shared.t.sol";
import {Base as BaseAddresses, CrossChain} from "tests/utils/Addresses.sol";
import {Vm} from "forge-std/Vm.sol";

contract Smoke_CrossChainRemoteStrategyBase_BalanceUpdate_Test is Smoke_CrossChainRemoteStrategyBase_Shared_Test {
    function test_sendBalanceUpdate() public {
        // Transfer USDC to strategy
        vm.prank(rafael);
        usdc.transfer(address(crossChainRemoteStrategy), 1234e6);

        uint256 balanceBefore = crossChainRemoteStrategy.checkBalance(BaseAddresses.USDC);
        uint64 nonceBefore = crossChainRemoteStrategy.lastTransferNonce();

        // Send balance update
        vm.recordLogs();
        vm.prank(strategistAddr);
        crossChainRemoteStrategy.sendBalanceUpdate();

        // Verify MessageTransmitted event
        Vm.Log[] memory entries = vm.getRecordedLogs();
        bytes32 messageTransmittedTopic = keccak256("MessageTransmitted(uint32,address,uint32,bytes)");

        bool found = false;
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics[0] == messageTransmittedTopic) {
                found = true;

                (uint32 destinationDomain,, uint32 minFinalityThreshold, bytes memory message) =
                    abi.decode(entries[i].data, (uint32, address, uint32, bytes));

                assertEq(destinationDomain, 0, "destinationDomain should be Ethereum (0)");
                assertEq(minFinalityThreshold, 2000, "minFinalityThreshold should be 2000");

                // Decode balance check message
                (uint64 nonce, uint256 balance, bool transferConfirmation,) = _decodeBalanceCheckMessage(message);

                assertEq(nonce, nonceBefore, "nonce should match");
                assertApproxEqAbs(balance, balanceBefore, 1e6, "balance should match");
                assertFalse(transferConfirmation, "transferConfirmation should be false");

                break;
            }
        }
        assertTrue(found, "MessageTransmitted event not found");
    }
}
