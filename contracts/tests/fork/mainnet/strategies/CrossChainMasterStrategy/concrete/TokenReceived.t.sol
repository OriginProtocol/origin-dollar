// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {Mainnet, Base as BaseAddresses, CrossChain} from "tests/utils/Addresses.sol";

contract Fork_CrossChainMasterStrategy_TokenReceived_Test is Fork_CrossChainMasterStrategy_Shared_Test {
    function test_tokenReceived_acceptsWithdrawalTokens() public {
        _skipIfTransferPending();

        // Set remote balance and withdraw
        _setRemoteStrategyBalance(123456e6);

        vm.prank(vaultAddr);
        crossChainMasterStrategy.withdraw(vaultAddr, Mainnet.USDC, 1000e6);

        uint64 lastNonce = crossChainMasterStrategy.lastTransferNonce();

        // Replace transmitter
        _replaceMessageTransmitter();

        // Build balance check payload (withdrawal confirmation)
        bytes memory balancePayload = _encodeBalanceCheckMessage(lastNonce, 12345e6, true, block.timestamp);

        // Wrap in burn message body (burnToken = Base.USDC = peer USDC)
        bytes memory burnPayload = _encodeBurnMessageBody(
            address(crossChainMasterStrategy), // sender
            address(crossChainMasterStrategy), // recipient
            BaseAddresses.USDC, // burnToken (peer USDC on Base)
            2342e6, // amount
            balancePayload // hookData
        );

        // Wrap in CCTP message (sender=CCTPTokenMessengerV2 to trigger burn path)
        bytes memory message =
            _encodeCCTPMessage(6, CrossChain.CCTPTokenMessengerV2, CrossChain.CCTPTokenMessengerV2, burnPayload);

        // Simulate CCTP minting: transfer USDC to strategy
        vm.prank(matt);
        usdc.transfer(address(crossChainMasterStrategy), 2342e6);

        // Relay
        vm.prank(relayer);
        crossChainMasterStrategy.relay(message, "");

        assertEq(
            crossChainMasterStrategy.remoteStrategyBalance(),
            12345e6,
            "remoteStrategyBalance should be updated to 12345 USDC"
        );
    }

    function test_revert_invalidBurnToken() public {
        _skipIfTransferPending();

        // Set remote balance for withdrawal
        _setRemoteStrategyBalance(123456e6);

        uint64 lastNonce = crossChainMasterStrategy.lastTransferNonce();

        // Replace transmitter
        _replaceMessageTransmitter();

        // Build balance check payload
        bytes memory balancePayload = _encodeBalanceCheckMessage(lastNonce, 12345e6, true, block.timestamp);

        // Wrap in burn message with WRONG burn token (WETH instead of peer USDC)
        bytes memory burnPayload = _encodeBurnMessageBody(
            address(crossChainMasterStrategy),
            address(crossChainMasterStrategy),
            Mainnet.WETH, // NOT peer USDC
            2342e6,
            balancePayload
        );

        // Wrap in CCTP message
        bytes memory message =
            _encodeCCTPMessage(6, CrossChain.CCTPTokenMessengerV2, CrossChain.CCTPTokenMessengerV2, burnPayload);

        // Relay should revert
        vm.prank(relayer);
        vm.expectRevert("Invalid burn token");
        crossChainMasterStrategy.relay(message, "");
    }
}
