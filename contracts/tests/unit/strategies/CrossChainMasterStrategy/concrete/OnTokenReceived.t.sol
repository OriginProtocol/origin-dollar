// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Project imports
import {CrossChainStrategyHelper} from "contracts/strategies/crosschain/CrossChainStrategyHelper.sol";
import {ICrossChainMasterStrategy} from "contracts/interfaces/strategies/ICrossChainMasterStrategy.sol";

contract Unit_Concrete_CrossChainMasterStrategy_OnTokenReceived_Test is Unit_CrossChainMasterStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ON TOKEN RECEIVED (via relay with token transfer)
    //////////////////////////////////////////////////////

    function setUp() public override {
        super.setUp();
        // Do a full deposit so we have a pending withdrawal to confirm
        _completeDepositFlow(5000e6);
    }

    function test_onTokenReceived_transfersUsdcToVault() public {
        // Withdraw from remote strategy
        vm.prank(address(ousdVault));
        crossChainMasterStrategy.withdraw(address(ousdVault), address(mockUsdc), 1000e6);

        uint64 nonce = crossChainMasterStrategy.lastTransferNonce();

        // Build balance check payload (the hook data that comes with the token transfer)
        bytes memory balanceCheckMsg =
            CrossChainStrategyHelper.encodeBalanceCheckMessage(nonce, 4000e6, true, block.timestamp);

        // Build burn message body (simulates the CCTP token transfer from remote)
        bytes memory burnBody = _buildBurnMessageBody(1000e6, balanceCheckMsg);

        // Mint USDC to the transmitter (simulates CCTP minting)
        _mintUsdc(address(cctpMessageTransmitterMock), 1000e6);

        // Send the token transfer message via the mock
        vm.prank(address(cctpTokenMessengerMock));
        cctpMessageTransmitterMock.sendTokenTransferMessage(
            0, // destinationDomain (mainnet, so mock sets sourceDomain=6=peerDomainID)
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            2000,
            1000e6,
            burnBody
        );

        uint256 vaultBalBefore = mockUsdc.balanceOf(address(ousdVault));
        // processBack because withdraw() queued a message to peerStrategy at front
        cctpMessageTransmitterMock.processBack();

        // USDC should have been forwarded to the vault
        uint256 vaultBalAfter = mockUsdc.balanceOf(address(ousdVault));
        assertEq(vaultBalAfter - vaultBalBefore, 1000e6);

        // Nonce should be processed
        assertTrue(crossChainMasterStrategy.isNonceProcessed(nonce));

        // Remote balance updated
        assertEq(crossChainMasterStrategy.remoteStrategyBalance(), 4000e6);
    }

    function test_onTokenReceived_emitsWithdrawalEvent() public {
        vm.prank(address(ousdVault));
        crossChainMasterStrategy.withdraw(address(ousdVault), address(mockUsdc), 500e6);

        uint64 nonce = crossChainMasterStrategy.lastTransferNonce();
        bytes memory balanceCheckMsg =
            CrossChainStrategyHelper.encodeBalanceCheckMessage(nonce, 4500e6, true, block.timestamp);
        bytes memory burnBody = _buildBurnMessageBody(500e6, balanceCheckMsg);

        _mintUsdc(address(cctpMessageTransmitterMock), 500e6);

        vm.prank(address(cctpTokenMessengerMock));
        cctpMessageTransmitterMock.sendTokenTransferMessage(
            0,
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            bytes32(uint256(uint160(address(crossChainMasterStrategy)))),
            2000,
            500e6,
            burnBody
        );

        vm.expectEmit(true, true, true, true);
        emit ICrossChainMasterStrategy.Withdrawal(address(mockUsdc), address(mockUsdc), 500e6);

        // processBack because withdraw() queued a message to peerStrategy at front
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
            burnTokenBytes32, // burnToken
            recipientBytes32, // mintRecipient
            amount, // amount
            messageSenderBytes32, // messageSender
            maxFee, // maxFee
            feeExecuted, // feeExecuted
            expirationBlock, // expirationBlock
            hookData // hookData
        );
    }
}
