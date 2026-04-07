// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {CrossChainStrategyHelper} from "contracts/strategies/crosschain/CrossChainStrategyHelper.sol";

contract Unit_Concrete_CrossChainMasterStrategy_Relay_Test is Unit_CrossChainMasterStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- RELAY SECURITY VALIDATIONS
    //////////////////////////////////////////////////////

    function test_relay_RevertWhen_calledByNonOperator() public {
        bytes memory dummyMessage = _buildValidOriginMessage();

        vm.prank(alice);
        vm.expectRevert("Caller is not the Operator");
        crossChainMasterStrategy.relay(dummyMessage, bytes(""));
    }

    function test_relay_RevertWhen_invalidCCTPVersion() public {
        bytes memory msg_ = CrossChainStrategyHelper.encodeBalanceCheckMessage(1, 0, false, block.timestamp);

        cctpMessageTransmitterMock.sendMessage(
            0, // destination mainnet, so source=6=peerDomainID
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            2000,
            msg_
        );

        vm.expectRevert("Invalid CCTP message version");
        cctpMessageTransmitterMock.processFrontOverrideVersion(99);
    }

    function test_relay_RevertWhen_unexpectedRecipient() public {
        bytes memory msg_ = CrossChainStrategyHelper.encodeBalanceCheckMessage(1, 0, false, block.timestamp);

        cctpMessageTransmitterMock.sendMessage(
            0,
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            2000,
            msg_
        );

        vm.expectRevert("Unexpected recipient address");
        cctpMessageTransmitterMock.processFrontOverrideRecipient(alice);
    }

    function test_relay_RevertWhen_incorrectSender() public {
        bytes memory msg_ = CrossChainStrategyHelper.encodeBalanceCheckMessage(1, 0, false, block.timestamp);

        cctpMessageTransmitterMock.sendMessage(
            0,
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            2000,
            msg_
        );

        cctpMessageTransmitterMock.overrideSender(alice);

        vm.expectRevert("Incorrect sender/recipient address");
        cctpMessageTransmitterMock.processFront();
    }

    function test_relay_RevertWhen_unknownSourceDomain() public {
        bytes memory msg_ = CrossChainStrategyHelper.encodeBalanceCheckMessage(1, 0, false, block.timestamp);

        // Destination = 6 causes mock to set sourceDomain = 0, but master expects peerDomainID = 6
        cctpMessageTransmitterMock.sendMessage(
            6, // wrong destination - makes mock set sourceDomain=0 instead of 6
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            2000,
            msg_
        );

        vm.expectRevert("Unknown Source Domain");
        cctpMessageTransmitterMock.processFront();
    }

    //////////////////////////////////////////////////////
    /// --- ON TOKEN RECEIVED via relay — nonce already processed
    //////////////////////////////////////////////////////

    function test_onTokenReceived_RevertWhen_nonceAlreadyProcessed() public {
        _completeDepositFlow(5000e6);

        // Request a withdraw so nonce gets incremented
        vm.prank(address(ousdVault));
        crossChainMasterStrategy.withdraw(address(ousdVault), address(mockUsdc), 1000e6);

        uint64 nonce = crossChainMasterStrategy.lastTransferNonce();

        // Simulate the withdrawal confirmation token transfer arriving
        bytes memory balanceCheckMsg =
            CrossChainStrategyHelper.encodeBalanceCheckMessage(nonce, 4000e6, true, block.timestamp);
        bytes memory burnBody = _buildBurnMessageBody(1000e6, balanceCheckMsg);
        _mintUsdc(address(cctpMessageTransmitterMock), 1000e6);

        vm.prank(address(cctpTokenMessengerMock));
        cctpMessageTransmitterMock.sendTokenTransferMessage(
            0,
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            2000,
            1000e6,
            burnBody
        );

        // processBack because withdraw() queued a message to peerStrategy at front
        cctpMessageTransmitterMock.processBack();
        assertTrue(crossChainMasterStrategy.isNonceProcessed(nonce));

        // Try to send a second token transfer with the same nonce
        // The strategy should revert "Nonce already processed"
        _mintUsdc(address(cctpMessageTransmitterMock), 500e6);
        bytes memory burnBody2 = _buildBurnMessageBody(500e6, balanceCheckMsg);

        vm.prank(address(cctpTokenMessengerMock));
        cctpMessageTransmitterMock.sendTokenTransferMessage(
            0,
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            2000,
            500e6,
            burnBody2
        );

        vm.expectRevert("Nonce already processed");
        cctpMessageTransmitterMock.processBack();
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _buildBurnMessageBody(uint256 amount, bytes memory hookData) internal view returns (bytes memory) {
        bytes32 burnTokenBytes32 = bytes32(uint256(uint160(address(peerUsdc))));
        bytes32 recipientBytes32 = bytes32(uint256(uint160(address(crossChainMasterStrategy))));
        bytes32 messageSenderBytes32 = bytes32(uint256(uint160(peerStrategy)));
        bytes32 expirationBlock = bytes32(0);
        uint256 maxFee = 0;
        uint256 feeExecuted = 0;

        return abi.encodePacked(
            uint32(1), // version
            burnTokenBytes32,
            recipientBytes32,
            amount,
            messageSenderBytes32,
            maxFee,
            feeExecuted,
            expirationBlock,
            hookData
        );
    }

    function _buildValidOriginMessage() internal view returns (bytes memory) {
        bytes memory payload = CrossChainStrategyHelper.encodeBalanceCheckMessage(1, 0, false, block.timestamp);
        return abi.encodePacked(
            uint32(1), // CCTP version
            uint32(6), // sourceDomain = peerDomainID
            bytes32(0), // destinationDomain
            bytes4(0), // nonce
            bytes32(uint256(uint160(peerStrategy))), // sender
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))), // recipient
            bytes32(0),
            bytes8(0),
            payload
        );
    }
}
