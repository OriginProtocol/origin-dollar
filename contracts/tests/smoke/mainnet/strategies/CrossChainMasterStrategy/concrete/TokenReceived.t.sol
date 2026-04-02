// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {Mainnet, Base as BaseAddresses, CrossChain} from "tests/utils/Addresses.sol";

contract Smoke_CrossChainMasterStrategy_TokenReceived_Test is Smoke_CrossChainMasterStrategy_Shared_Test {
    function test_tokenReceived_acceptsWithdrawalTokens() public {
        _skipIfTransferPending();

        // Set remote balance and withdraw
        _setRemoteStrategyBalance(123456e6);

        vm.prank(vaultAddr);
        crossChainMasterStrategy.withdraw(vaultAddr, Mainnet.USDC, 1000e6);

        uint64 lastNonce = crossChainMasterStrategy.lastTransferNonce();

        _mockReceiveMessage();

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
}
