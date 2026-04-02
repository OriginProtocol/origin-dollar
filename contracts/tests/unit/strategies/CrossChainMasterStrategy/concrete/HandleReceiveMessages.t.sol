// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {CrossChainStrategyHelper} from "contracts/strategies/crosschain/CrossChainStrategyHelper.sol";

contract Unit_Concrete_CrossChainMasterStrategy_HandleReceiveMessages_Test is
    Unit_CrossChainMasterStrategy_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- HANDLE RECEIVE FINALIZED MESSAGE
    //////////////////////////////////////////////////////

    function test_handleReceiveFinalizedMessage_processesBalanceCheck() public {
        bytes memory payload = CrossChainStrategyHelper.encodeBalanceCheckMessage(0, 1000e6, false, block.timestamp);

        vm.prank(address(cctpMessageTransmitterMock));
        bool result = crossChainMasterStrategy.handleReceiveFinalizedMessage(
            6, bytes32(uint256(uint160(peerStrategy))), 2000, payload
        );
        assertTrue(result);
    }

    function test_handleReceiveFinalizedMessage_RevertWhen_calledByNonTransmitter() public {
        bytes memory payload = CrossChainStrategyHelper.encodeBalanceCheckMessage(0, 0, false, block.timestamp);

        vm.prank(alice);
        vm.expectRevert("Caller is not CCTP transmitter");
        crossChainMasterStrategy.handleReceiveFinalizedMessage(
            6, bytes32(uint256(uint160(peerStrategy))), 2000, payload
        );
    }

    function test_handleReceiveFinalizedMessage_RevertWhen_finalityTooLow() public {
        bytes memory payload = CrossChainStrategyHelper.encodeBalanceCheckMessage(0, 0, false, block.timestamp);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Finality threshold too low");
        crossChainMasterStrategy.handleReceiveFinalizedMessage(
            6, bytes32(uint256(uint160(peerStrategy))), 1999, payload
        );
    }

    function test_handleReceiveFinalizedMessage_RevertWhen_unknownSourceDomain() public {
        bytes memory payload = CrossChainStrategyHelper.encodeBalanceCheckMessage(0, 0, false, block.timestamp);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Unknown Source Domain");
        crossChainMasterStrategy.handleReceiveFinalizedMessage(
            99, bytes32(uint256(uint160(peerStrategy))), 2000, payload
        );
    }

    function test_handleReceiveFinalizedMessage_RevertWhen_unknownSender() public {
        bytes memory payload = CrossChainStrategyHelper.encodeBalanceCheckMessage(0, 0, false, block.timestamp);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Unknown Sender");
        crossChainMasterStrategy.handleReceiveFinalizedMessage(6, bytes32(uint256(uint160(alice))), 2000, payload);
    }

    function test_handleReceiveFinalizedMessage_RevertWhen_unknownMessageType() public {
        // Build a message with deposit type (not balance check) - master only expects balance check
        bytes memory payload = CrossChainStrategyHelper.encodeDepositMessage(1, 100e6);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Unknown message type");
        crossChainMasterStrategy.handleReceiveFinalizedMessage(
            6, bytes32(uint256(uint160(peerStrategy))), 2000, payload
        );
    }

    //////////////////////////////////////////////////////
    /// --- HANDLE RECEIVE UNFINALIZED MESSAGE
    //////////////////////////////////////////////////////

    function test_handleReceiveUnfinalizedMessage_RevertWhen_thresholdNot1000() public {
        // Strategy initialized with minFinalityThreshold = 2000
        bytes memory payload = CrossChainStrategyHelper.encodeBalanceCheckMessage(0, 0, false, block.timestamp);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Unfinalized messages are not supported");
        crossChainMasterStrategy.handleReceiveUnfinalizedMessage(
            6, bytes32(uint256(uint160(peerStrategy))), 1000, payload
        );
    }

    function test_handleReceiveUnfinalizedMessage_succeeds_whenThresholdIs1000() public {
        // Set threshold to 1000 to allow unfinalized messages
        vm.prank(governor);
        crossChainMasterStrategy.setMinFinalityThreshold(1000);

        bytes memory payload = CrossChainStrategyHelper.encodeBalanceCheckMessage(0, 500e6, false, block.timestamp);

        vm.prank(address(cctpMessageTransmitterMock));
        bool result = crossChainMasterStrategy.handleReceiveUnfinalizedMessage(
            6, bytes32(uint256(uint160(peerStrategy))), 1000, payload
        );
        assertTrue(result);
    }

    function test_handleReceiveUnfinalizedMessage_RevertWhen_finalityTooLow() public {
        // Set threshold to 1000
        vm.prank(governor);
        crossChainMasterStrategy.setMinFinalityThreshold(1000);

        bytes memory payload = CrossChainStrategyHelper.encodeBalanceCheckMessage(0, 0, false, block.timestamp);

        vm.prank(address(cctpMessageTransmitterMock));
        vm.expectRevert("Finality threshold too low");
        crossChainMasterStrategy.handleReceiveUnfinalizedMessage(
            6, bytes32(uint256(uint160(peerStrategy))), 999, payload
        );
    }
}
