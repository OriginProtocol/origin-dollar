// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainRemoteStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {CrossChainRemoteStrategy} from "contracts/strategies/crosschain/CrossChainRemoteStrategy.sol";
import {CrossChainStrategyHelper} from "contracts/strategies/crosschain/CrossChainStrategyHelper.sol";

contract Unit_Concrete_CrossChainRemoteStrategy_Relay_Test is Unit_CrossChainRemoteStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- RELAY SECURITY VALIDATIONS
    //////////////////////////////////////////////////////

    function test_relay_RevertWhen_calledByNonOperator() public {
        bytes memory dummyMessage = _buildValidNonTokenMessage();

        vm.prank(alice);
        vm.expectRevert("Caller is not the Operator");
        crossChainRemoteStrategy.relay(dummyMessage, bytes(""));
    }

    function test_relay_RevertWhen_invalidCCTPVersion() public {
        // Use processFrontOverrideVersion to set invalid CCTP message version
        bytes memory msg_ = CrossChainStrategyHelper.encodeBalanceCheckMessage(1, 0, false, block.timestamp);

        // Queue a message with valid content
        cctpMessageTransmitterMock.sendMessage(
            6, // destination (so source=0=peerDomainID)
            bytes32(uint256(uint160(address(crossChainRemoteStrategy)))),
            bytes32(uint256(uint160(address(crossChainRemoteStrategy)))),
            2000,
            msg_
        );

        vm.expectRevert("Invalid CCTP message version");
        cctpMessageTransmitterMock.processFrontOverrideVersion(99);
    }

    function test_relay_RevertWhen_unknownSourceDomain() public {
        bytes memory msg_ = CrossChainStrategyHelper.encodeBalanceCheckMessage(1, 0, false, block.timestamp);

        // Destination = 0 causes mock to set sourceDomain = 6, but remote expects peerDomainID = 0
        vm.prank(peerStrategy);
        cctpMessageTransmitterMock.sendMessage(
            0, // wrong destination - makes mock set sourceDomain=6 instead of 0
            bytes32(uint256(uint160(address(crossChainRemoteStrategy)))),
            bytes32(uint256(uint160(address(crossChainRemoteStrategy)))),
            2000,
            msg_
        );

        vm.expectRevert("Unknown Source Domain");
        cctpMessageTransmitterMock.processFront();
    }

    function test_relay_RevertWhen_unexpectedRecipient() public {
        bytes memory msg_ = CrossChainStrategyHelper.encodeBalanceCheckMessage(1, 0, false, block.timestamp);

        cctpMessageTransmitterMock.sendMessage(
            6,
            bytes32(uint256(uint160(address(crossChainRemoteStrategy)))),
            bytes32(uint256(uint160(address(crossChainRemoteStrategy)))),
            2000,
            msg_
        );

        // Override the recipient in the header to a different address
        vm.expectRevert("Unexpected recipient address");
        cctpMessageTransmitterMock.processFrontOverrideRecipient(alice);
    }

    function test_relay_RevertWhen_incorrectSender() public {
        bytes memory msg_ = CrossChainStrategyHelper.encodeBalanceCheckMessage(1, 0, false, block.timestamp);

        cctpMessageTransmitterMock.sendMessage(
            6,
            bytes32(uint256(uint160(address(crossChainRemoteStrategy)))),
            bytes32(uint256(uint160(address(crossChainRemoteStrategy)))),
            2000,
            msg_
        );

        // Override sender to an unexpected address
        cctpMessageTransmitterMock.overrideSender(alice);

        vm.expectRevert("Incorrect sender/recipient address");
        cctpMessageTransmitterMock.processFront();
    }

    function test_relay_processesNonTokenMessage() public {
        // This tests the non-burn-message path through relay where version == ORIGIN_MESSAGE_VERSION
        // Using a withdraw message as the payload (non-token message)
        uint64 nonce = crossChainRemoteStrategy.lastTransferNonce() + 1;

        // First deposit so there's something to withdraw
        _depositAsGovernor(1000e6);

        _simulateIncomingWithdraw(nonce, 500e6);
        cctpMessageTransmitterMock.processFront();

        assertTrue(crossChainRemoteStrategy.isNonceProcessed(nonce));
    }

    //////////////////////////////////////////////////////
    /// --- NONCE EDGE CASES
    //////////////////////////////////////////////////////

    function test_markNonceAsProcessed_RevertWhen_nonceTooLow() public {
        // Process a deposit to set lastTransferNonce = 1
        _depositAsGovernor(1000e6);
        uint64 nonce = crossChainRemoteStrategy.lastTransferNonce() + 1;
        _simulateIncomingDeposit(nonce, 500e6);
        cctpMessageTransmitterMock.processFront();

        // Now try to process a message with nonce = 0 (too low)
        // Send a withdraw message with nonce = 0
        bytes memory withdrawPayload = CrossChainStrategyHelper.encodeWithdrawMessage(0, 100e6);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Nonce too low");
        crossChainRemoteStrategy.handleReceiveFinalizedMessage(
            0, bytes32(uint256(uint160(peerStrategy))), 2000, withdrawPayload
        );
    }

    function test_markNonceAsProcessed_RevertWhen_nonceAlreadyProcessed() public {
        uint64 nonce = crossChainRemoteStrategy.lastTransferNonce() + 1;

        // Process deposit message (marks nonce as processed)
        _simulateIncomingDeposit(nonce, 500e6);
        cctpMessageTransmitterMock.processFront();

        assertTrue(crossChainRemoteStrategy.isNonceProcessed(nonce));

        // Try to process a withdraw message with the same nonce
        bytes memory withdrawPayload = CrossChainStrategyHelper.encodeWithdrawMessage(nonce, 100e6);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Nonce already processed");
        crossChainRemoteStrategy.handleReceiveFinalizedMessage(
            0, bytes32(uint256(uint160(peerStrategy))), 2000, withdrawPayload
        );
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _buildValidNonTokenMessage() internal view returns (bytes memory) {
        bytes memory payload = CrossChainStrategyHelper.encodeBalanceCheckMessage(1, 0, false, block.timestamp);
        // Build a message with version 1, sourceDomain 0, sender=peerStrategy, recipient=strategy
        return abi.encodePacked(
            uint32(1), // version
            uint32(0), // sourceDomain = peerDomainID
            bytes32(0), // destinationDomain
            bytes4(0), // nonce
            bytes32(uint256(uint160(peerStrategy))), // sender
            bytes32(uint256(uint160(address(crossChainRemoteStrategy)))), // recipient
            bytes32(0), // other stuff
            bytes8(0), // other stuff
            payload
        );
    }
}
