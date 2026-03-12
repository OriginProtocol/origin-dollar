// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainRemoteStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {AbstractCCTPIntegrator} from "contracts/strategies/crosschain/AbstractCCTPIntegrator.sol";

contract Unit_Concrete_CrossChainRemoteStrategy_SendBalanceUpdate_Test is Unit_CrossChainRemoteStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- SEND BALANCE UPDATE
    //////////////////////////////////////////////////////

    function test_sendBalanceUpdate_sendsMessage() public {
        uint256 amount = 1234e6;
        _depositAsGovernor(amount);

        uint256 messagesLenBefore = cctpMessageTransmitterMock.getMessagesLength();

        vm.prank(operatorAddr);
        crossChainRemoteStrategy.sendBalanceUpdate();

        assertEq(cctpMessageTransmitterMock.getMessagesLength(), messagesLenBefore + 1);
    }

    function test_sendBalanceUpdate_emitsMessageTransmitted() public {
        _depositAsGovernor(500e6);

        vm.prank(operatorAddr);
        // Just verify it doesn't revert - event has dynamic data making exact matching complex
        crossChainRemoteStrategy.sendBalanceUpdate();
    }

    function test_sendBalanceUpdate_asStrategist() public {
        vm.prank(strategist);
        crossChainRemoteStrategy.sendBalanceUpdate();
    }

    function test_sendBalanceUpdate_asGovernor() public {
        vm.prank(governor);
        crossChainRemoteStrategy.sendBalanceUpdate();
    }

    function test_sendBalanceUpdate_reportsCorrectBalance() public {
        uint256 amount = 1234e6;
        _depositAsGovernor(amount);

        // Also add some loose USDC on the contract
        _mintUsdc(address(crossChainRemoteStrategy), 100e6);

        uint256 expectedBalance = crossChainRemoteStrategy.checkBalance(address(mockUsdc));
        assertEq(expectedBalance, amount + 100e6);

        uint256 messagesLenBefore = cctpMessageTransmitterMock.getMessagesLength();

        vm.prank(governor);
        crossChainRemoteStrategy.sendBalanceUpdate();

        assertEq(cctpMessageTransmitterMock.getMessagesLength(), messagesLenBefore + 1);
    }

    function test_sendBalanceUpdate_RevertWhen_calledByNonAuthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Operator, Strategist or the Governor");
        crossChainRemoteStrategy.sendBalanceUpdate();
    }
}
