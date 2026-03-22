// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Smoke_CrossChainRemoteStrategyBase_Shared_Test } from "../shared/Shared.t.sol";
import { Mainnet, Base as BaseAddresses, CrossChain } from "tests/utils/Addresses.sol";
import { CrossChainStrategyHelper } from "contracts/strategies/crosschain/CrossChainStrategyHelper.sol";
import { Vm } from "forge-std/Vm.sol";

contract Smoke_CrossChainRemoteStrategyBase_Withdraw_Test is
    Smoke_CrossChainRemoteStrategyBase_Shared_Test
{
    function test_withdraw_handlesIncomingWithdraw() public {
        uint256 withdrawalAmount = 1_234_560_000; // 1234.56 USDC
        uint256 depositAmount = withdrawalAmount * 2;

        // Deposit 2x withdrawal amount first
        vm.prank(rafael);
        usdc.transfer(address(crossChainRemoteStrategy), depositAmount);
        vm.prank(strategistAddr);
        crossChainRemoteStrategy.deposit(BaseAddresses.USDC, depositAmount);

        // Snapshot state
        uint256 balanceBefore = crossChainRemoteStrategy.checkBalance(
            BaseAddresses.USDC
        );
        uint64 nonceBefore = crossChainRemoteStrategy.lastTransferNonce();
        uint64 nextNonce = nonceBefore + 1;

        // Build withdraw message (no burn wrapper, just Origin message in CCTP envelope)
        bytes memory withdrawPayload = CrossChainStrategyHelper
            .encodeWithdrawMessage(nextNonce, withdrawalAmount);
        bytes memory message = _encodeCCTPMessage(
            0,
            address(crossChainRemoteStrategy),
            address(crossChainRemoteStrategy),
            withdrawPayload
        );

        // Replace transmitter
        _replaceMessageTransmitter();

        // Relay
        vm.recordLogs();
        vm.prank(relayer);
        crossChainRemoteStrategy.relay(message, "");

        // Verify nonce updated
        assertEq(
            crossChainRemoteStrategy.lastTransferNonce(),
            nextNonce,
            "nonce should be updated"
        );

        // Verify balance decreased
        uint256 balanceAfter = crossChainRemoteStrategy.checkBalance(
            BaseAddresses.USDC
        );
        assertApproxEqAbs(
            balanceAfter,
            balanceBefore - withdrawalAmount,
            1e6,
            "checkBalance should decrease by withdrawal amount"
        );

        // Verify a message was sent back (either DepositForBurn or MessageTransmitted)
        Vm.Log[] memory entries = vm.getRecordedLogs();
        bytes32 messageTransmittedTopic = keccak256(
            "MessageTransmitted(uint32,address,uint32,bytes)"
        );
        bytes32 tokensBridgedTopic = keccak256(
            "TokensBridged(uint32,address,address,uint256,uint256,uint32,bytes)"
        );

        bool foundMessage = false;
        for (uint256 i = 0; i < entries.length; i++) {
            if (
                entries[i].topics[0] == messageTransmittedTopic ||
                entries[i].topics[0] == tokensBridgedTopic
            ) {
                foundMessage = true;
                break;
            }
        }
        assertTrue(foundMessage, "Should have sent a response message back");
    }
}
