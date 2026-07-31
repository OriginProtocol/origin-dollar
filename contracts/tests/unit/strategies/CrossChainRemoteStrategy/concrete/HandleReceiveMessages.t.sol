// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_CrossChainRemoteStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Project imports
import {CrossChainStrategyHelper} from "contracts/strategies/crosschain/CrossChainStrategyHelper.sol";

contract Unit_Concrete_CrossChainRemoteStrategy_HandleReceiveMessages_Test is
    Unit_CrossChainRemoteStrategy_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- HANDLE RECEIVE FINALIZED MESSAGE
    //////////////////////////////////////////////////////

    function test_handleReceiveFinalizedMessage_processesWithdraw() public {
        // Pre-deposit so there are funds to withdraw
        _depositAsGovernor(2000e6);

        uint64 nonce = crossChainRemoteStrategy.lastTransferNonce() + 1;
        bytes memory payload = CrossChainStrategyHelper.encodeWithdrawMessage(nonce, 500e6);

        vm.prank(address(cctpMessageTransmitterMock));
        bool result = crossChainRemoteStrategy.handleReceiveFinalizedMessage(
            0, bytes32(uint256(uint160(peerStrategy))), 2000, payload
        );
        assertTrue(result);
    }

    function test_handleReceiveFinalizedMessage_RevertWhen_calledByNonTransmitter() public {
        bytes memory payload = CrossChainStrategyHelper.encodeWithdrawMessage(1, 100e6);

        vm.prank(alice);
        vm.expectRevert("Caller is not CCTP transmitter");
        crossChainRemoteStrategy.handleReceiveFinalizedMessage(
            0, bytes32(uint256(uint160(peerStrategy))), 2000, payload
        );
    }

    function test_handleReceiveFinalizedMessage_RevertWhen_finalityTooLow() public {
        bytes memory payload = CrossChainStrategyHelper.encodeWithdrawMessage(1, 100e6);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Finality threshold too low");
        crossChainRemoteStrategy.handleReceiveFinalizedMessage(
            0, bytes32(uint256(uint160(peerStrategy))), 1999, payload
        );
    }

    function test_handleReceiveFinalizedMessage_RevertWhen_unknownSourceDomain() public {
        bytes memory payload = CrossChainStrategyHelper.encodeWithdrawMessage(1, 100e6);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Unknown Source Domain");
        crossChainRemoteStrategy.handleReceiveFinalizedMessage(
            99, bytes32(uint256(uint160(peerStrategy))), 2000, payload
        );
    }

    function test_handleReceiveFinalizedMessage_RevertWhen_unknownSender() public {
        bytes memory payload = CrossChainStrategyHelper.encodeWithdrawMessage(1, 100e6);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Unknown Sender");
        crossChainRemoteStrategy.handleReceiveFinalizedMessage(0, bytes32(uint256(uint160(alice))), 2000, payload);
    }

    function test_handleReceiveFinalizedMessage_RevertWhen_unknownMessageType() public {
        bytes memory payload = CrossChainStrategyHelper.encodeBalanceCheckMessage(1, 100e6, false, block.timestamp);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Unknown message type");
        crossChainRemoteStrategy.handleReceiveFinalizedMessage(
            0, bytes32(uint256(uint160(peerStrategy))), 2000, payload
        );
    }

    //////////////////////////////////////////////////////
    /// --- HANDLE RECEIVE UNFINALIZED MESSAGE
    //////////////////////////////////////////////////////

    function test_handleReceiveUnfinalizedMessage_RevertWhen_thresholdNot1000() public {
        bytes memory payload = CrossChainStrategyHelper.encodeWithdrawMessage(1, 100e6);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Unfinalized messages are not supported");
        crossChainRemoteStrategy.handleReceiveUnfinalizedMessage(
            0, bytes32(uint256(uint160(peerStrategy))), 1000, payload
        );
    }

    function test_handleReceiveUnfinalizedMessage_succeeds_whenThresholdIs1000() public {
        _depositAsGovernor(2000e6);

        // Set threshold to 1000 to allow unfinalized messages
        vm.prank(governor);
        crossChainRemoteStrategy.setMinFinalityThreshold(1000);

        uint64 nonce = crossChainRemoteStrategy.lastTransferNonce() + 1;
        bytes memory payload = CrossChainStrategyHelper.encodeWithdrawMessage(nonce, 500e6);

        vm.prank(address(cctpMessageTransmitterMock));
        bool result = crossChainRemoteStrategy.handleReceiveUnfinalizedMessage(
            0, bytes32(uint256(uint160(peerStrategy))), 1000, payload
        );
        assertTrue(result);
    }

    function test_handleReceiveUnfinalizedMessage_RevertWhen_finalityTooLow() public {
        // Set threshold to 1000
        vm.prank(governor);
        crossChainRemoteStrategy.setMinFinalityThreshold(1000);

        bytes memory payload = CrossChainStrategyHelper.encodeWithdrawMessage(1, 100e6);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Finality threshold too low");
        crossChainRemoteStrategy.handleReceiveUnfinalizedMessage(
            0, bytes32(uint256(uint160(peerStrategy))), 999, payload
        );
    }

    //////////////////////////////////////////////////////
    /// --- DEPOSIT MESSAGE NO-OP ON _onMessageReceived
    //////////////////////////////////////////////////////

    function test_handleReceiveFinalizedMessage_depositMessageIsNoOp() public {
        // Deposit message type (1) on _onMessageReceived does nothing
        // because _onTokenReceived handles it instead
        uint64 nonce = crossChainRemoteStrategy.lastTransferNonce() + 1;
        bytes memory payload = CrossChainStrategyHelper.encodeDepositMessage(nonce, 100e6);

        vm.prank(address(cctpMessageTransmitterMock));
        bool result = crossChainRemoteStrategy.handleReceiveFinalizedMessage(
            0, bytes32(uint256(uint160(peerStrategy))), 2000, payload
        );
        assertTrue(result);

        // Nonce should NOT be processed (deposit message is a no-op in _onMessageReceived)
        assertFalse(crossChainRemoteStrategy.isNonceProcessed(nonce));
    }

    //////////////////////////////////////////////////////
    /// --- INVALID MESSAGE VERSION/TYPE
    //////////////////////////////////////////////////////

    function test_handleReceiveFinalizedMessage_RevertWhen_invalidOriginVersion() public {
        // Build a message with wrong origin version (not 1010)
        bytes memory invalidPayload = abi.encodePacked(
            uint32(999), // wrong version (should be 1010 / 0x3F2)
            uint32(2), // message type
            bytes32(0), // data
            bytes32(0) // more data
        );

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Invalid Origin Message Version");
        crossChainRemoteStrategy.handleReceiveFinalizedMessage(
            0, bytes32(uint256(uint160(peerStrategy))), 2000, invalidPayload
        );
    }

    function test_handleReceiveFinalizedMessage_RevertWhen_invalidMessageType() public {
        // Build a message with valid origin version but invalid type
        bytes memory invalidPayload = abi.encodePacked(
            uint32(1010), // correct origin version
            uint32(99), // invalid message type
            bytes32(0), // data
            bytes32(0) // more data
        );

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Unknown message type");
        crossChainRemoteStrategy.handleReceiveFinalizedMessage(
            0, bytes32(uint256(uint160(peerStrategy))), 2000, invalidPayload
        );
    }
}
