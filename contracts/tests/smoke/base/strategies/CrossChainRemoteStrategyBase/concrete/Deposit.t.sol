// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_CrossChainRemoteStrategyBase_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Mainnet, Base as BaseAddresses, CrossChain} from "tests/utils/Addresses.sol";

// --- External libraries
import {Vm} from "forge-std/Vm.sol";

contract Smoke_CrossChainRemoteStrategyBase_Deposit_Test is Smoke_CrossChainRemoteStrategyBase_Shared_Test {
    function test_deposit_handlesIncomingDeposit() public {
        uint256 balanceBefore = crossChainRemoteStrategy.checkBalance(BaseAddresses.USDC);
        uint64 nonceBefore = crossChainRemoteStrategy.lastTransferNonce();
        uint64 nextNonce = nonceBefore + 1;

        uint256 depositAmount = 1_234_560_000; // 1234.56 USDC

        // Replace transmitter
        _replaceMessageTransmitter();

        // Build deposit message
        bytes memory depositPayload = _encodeDepositMessage(nextNonce, depositAmount);

        // Wrap in burn message (burnToken = Mainnet.USDC = peer USDC for Base)
        bytes memory burnPayload = _encodeBurnMessageBody(
            address(crossChainRemoteStrategy),
            address(crossChainRemoteStrategy),
            Mainnet.USDC, // peer USDC
            depositAmount,
            depositPayload
        );

        // Wrap in CCTP message (sourceDomain=0 for Ethereum)
        bytes memory message =
            _encodeCCTPMessage(0, CrossChain.CCTPTokenMessengerV2, CrossChain.CCTPTokenMessengerV2, burnPayload);

        // Simulate token transfer (CCTP mint)
        vm.prank(rafael);
        usdc.transfer(address(crossChainRemoteStrategy), depositAmount);

        // Relay
        vm.recordLogs();
        vm.prank(relayer);
        crossChainRemoteStrategy.relay(message, "");

        // Verify balance check was sent back
        Vm.Log[] memory entries = vm.getRecordedLogs();
        bytes32 messageTransmittedTopic = keccak256("MessageTransmitted(uint32,address,uint32,bytes)");

        bool found = false;
        for (uint256 i = 0; i < entries.length; i++) {
            if (entries[i].topics[0] == messageTransmittedTopic) {
                found = true;
                break;
            }
        }
        assertTrue(found, "Balance check MessageTransmitted event not found");

        // Verify nonce updated
        assertEq(crossChainRemoteStrategy.lastTransferNonce(), nextNonce, "nonce should be updated");

        // Verify checkBalance increased
        uint256 balanceAfter = crossChainRemoteStrategy.checkBalance(BaseAddresses.USDC);
        assertApproxEqAbs(
            balanceAfter, balanceBefore + depositAmount, 1e6, "checkBalance should increase by deposit amount"
        );
    }

    function test_revert_invalidBurnToken() public {
        uint64 nonceBefore = crossChainRemoteStrategy.lastTransferNonce();
        uint64 nextNonce = nonceBefore + 1;
        uint256 depositAmount = 1_234_560_000;

        // Replace transmitter
        _replaceMessageTransmitter();

        // Build deposit message
        bytes memory depositPayload = _encodeDepositMessage(nextNonce, depositAmount);

        // Wrap in burn message with WRONG burn token (WETH instead of peer USDC)
        bytes memory burnPayload = _encodeBurnMessageBody(
            address(crossChainRemoteStrategy),
            address(crossChainRemoteStrategy),
            BaseAddresses.WETH, // NOT peer USDC
            depositAmount,
            depositPayload
        );

        // Wrap in CCTP message
        bytes memory message =
            _encodeCCTPMessage(0, CrossChain.CCTPTokenMessengerV2, CrossChain.CCTPTokenMessengerV2, burnPayload);

        // Relay should revert
        vm.prank(relayer);
        vm.expectRevert("Invalid burn token");
        crossChainRemoteStrategy.relay(message, "");
    }
}
