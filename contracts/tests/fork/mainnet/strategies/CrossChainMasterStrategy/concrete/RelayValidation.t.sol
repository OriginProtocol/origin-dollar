// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {Mainnet, Base as BaseAddresses, CrossChain} from "tests/utils/Addresses.sol";
import {CrossChainStrategyHelper} from "contracts/strategies/crosschain/CrossChainStrategyHelper.sol";

contract Fork_CrossChainMasterStrategy_RelayValidation_Test is Fork_CrossChainMasterStrategy_Shared_Test {
    /// @dev relay() reverts when called by a non-operator
    function test_revert_relay_onlyOperator() public {
        _skipIfTransferPending();
        _replaceMessageTransmitter();

        uint64 lastNonce = crossChainMasterStrategy.lastTransferNonce();
        bytes memory balancePayload =
            CrossChainStrategyHelper.encodeBalanceCheckMessage(lastNonce, 1000e6, false, block.timestamp);
        bytes memory message =
            _encodeCCTPMessage(6, address(crossChainMasterStrategy), address(crossChainMasterStrategy), balancePayload);

        vm.prank(matt);
        vm.expectRevert("Caller is not the Operator");
        crossChainMasterStrategy.relay(message, "");
    }

    /// @dev relay() reverts when source domain is not the peer domain (Base=6)
    function test_revert_relay_wrongSourceDomain() public {
        _skipIfTransferPending();
        _replaceMessageTransmitter();

        uint64 lastNonce = crossChainMasterStrategy.lastTransferNonce();
        bytes memory balancePayload =
            CrossChainStrategyHelper.encodeBalanceCheckMessage(lastNonce, 1000e6, false, block.timestamp);

        // Use sourceDomain=3 (Arbitrum) instead of 6 (Base)
        bytes memory message =
            _encodeCCTPMessage(3, address(crossChainMasterStrategy), address(crossChainMasterStrategy), balancePayload);

        vm.prank(relayer);
        vm.expectRevert("Unknown Source Domain");
        crossChainMasterStrategy.relay(message, "");
    }

    /// @dev relay() reverts when the recipient is not this contract
    function test_revert_relay_wrongRecipient() public {
        _skipIfTransferPending();
        _replaceMessageTransmitter();

        uint64 lastNonce = crossChainMasterStrategy.lastTransferNonce();
        bytes memory balancePayload =
            CrossChainStrategyHelper.encodeBalanceCheckMessage(lastNonce, 1000e6, false, block.timestamp);

        // recipient=matt instead of strategy
        bytes memory message = _encodeCCTPMessage(6, address(crossChainMasterStrategy), matt, balancePayload);

        vm.prank(relayer);
        vm.expectRevert("Unexpected recipient address");
        crossChainMasterStrategy.relay(message, "");
    }

    /// @dev relay() reverts when the sender is not the peer strategy
    function test_revert_relay_wrongSender() public {
        _skipIfTransferPending();
        _replaceMessageTransmitter();

        uint64 lastNonce = crossChainMasterStrategy.lastTransferNonce();
        bytes memory balancePayload =
            CrossChainStrategyHelper.encodeBalanceCheckMessage(lastNonce, 1000e6, false, block.timestamp);

        // sender=matt instead of strategy
        bytes memory message = _encodeCCTPMessage(6, matt, address(crossChainMasterStrategy), balancePayload);

        vm.prank(relayer);
        vm.expectRevert("Incorrect sender/recipient address");
        crossChainMasterStrategy.relay(message, "");
    }
}
