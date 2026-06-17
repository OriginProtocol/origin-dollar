// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_CrossChainRemoteStrategyBase_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_CrossChainRemoteStrategyBase_RelayValidation_Test is Smoke_CrossChainRemoteStrategyBase_Shared_Test {
    /// @dev relay() reverts when called by a non-operator
    function test_revert_relay_onlyOperator() public {
        _replaceMessageTransmitter();

        uint64 nonceBefore = crossChainRemoteStrategy.lastTransferNonce();
        bytes memory withdrawPayload = _encodeWithdrawMessage(nonceBefore + 1, 1000e6);
        bytes memory message = _encodeCCTPMessage(
            0, address(crossChainRemoteStrategy), address(crossChainRemoteStrategy), withdrawPayload
        );

        vm.prank(matt);
        vm.expectRevert("Caller is not the Operator");
        crossChainRemoteStrategy.relay(message, "");
    }

    /// @dev relay() reverts when source domain is not the peer domain (Ethereum=0)
    function test_revert_relay_wrongSourceDomain() public {
        _replaceMessageTransmitter();

        uint64 nonceBefore = crossChainRemoteStrategy.lastTransferNonce();
        bytes memory withdrawPayload = _encodeWithdrawMessage(nonceBefore + 1, 1000e6);

        // Use sourceDomain=6 (Base) instead of 0 (Ethereum)
        bytes memory message = _encodeCCTPMessage(
            6, address(crossChainRemoteStrategy), address(crossChainRemoteStrategy), withdrawPayload
        );

        vm.prank(relayer);
        vm.expectRevert("Unknown Source Domain");
        crossChainRemoteStrategy.relay(message, "");
    }

    /// @dev relay() reverts when the recipient is not this contract
    function test_revert_relay_wrongRecipient() public {
        _replaceMessageTransmitter();

        uint64 nonceBefore = crossChainRemoteStrategy.lastTransferNonce();
        bytes memory withdrawPayload = _encodeWithdrawMessage(nonceBefore + 1, 1000e6);

        bytes memory message = _encodeCCTPMessage(
            0,
            address(crossChainRemoteStrategy),
            matt, // wrong recipient
            withdrawPayload
        );

        vm.prank(relayer);
        vm.expectRevert("Unexpected recipient address");
        crossChainRemoteStrategy.relay(message, "");
    }

    /// @dev relay() reverts when the sender is not the peer strategy
    function test_revert_relay_wrongSender() public {
        _replaceMessageTransmitter();

        uint64 nonceBefore = crossChainRemoteStrategy.lastTransferNonce();
        bytes memory withdrawPayload = _encodeWithdrawMessage(nonceBefore + 1, 1000e6);

        bytes memory message = _encodeCCTPMessage(
            0,
            matt, // wrong sender
            address(crossChainRemoteStrategy),
            withdrawPayload
        );

        vm.prank(relayer);
        vm.expectRevert("Incorrect sender/recipient address");
        crossChainRemoteStrategy.relay(message, "");
    }
}
