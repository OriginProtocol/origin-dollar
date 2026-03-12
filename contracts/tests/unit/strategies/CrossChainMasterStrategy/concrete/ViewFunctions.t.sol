// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_Concrete_CrossChainMasterStrategy_ViewFunctions_Test is Unit_CrossChainMasterStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    // --- checkBalance ---

    function test_checkBalance_returnsZeroInitially() public view {
        assertEq(crossChainMasterStrategy.checkBalance(address(mockUsdc)), 0);
    }

    function test_checkBalance_includesLocalBalance() public {
        uint256 amount = 500e6;
        _mintUsdc(address(crossChainMasterStrategy), amount);

        assertEq(crossChainMasterStrategy.checkBalance(address(mockUsdc)), amount);
    }

    function test_checkBalance_includesPendingAmount() public {
        uint256 amount = 1000e6;
        _depositAsVault(amount);

        // checkBalance should include pendingAmount even though USDC left the contract
        assertEq(crossChainMasterStrategy.pendingAmount(), amount);
        assertEq(crossChainMasterStrategy.checkBalance(address(mockUsdc)), amount);
    }

    function test_checkBalance_includesRemoteBalance() public {
        uint256 amount = 2000e6;
        _completeDepositFlow(amount);

        assertEq(crossChainMasterStrategy.remoteStrategyBalance(), amount);
        assertEq(crossChainMasterStrategy.checkBalance(address(mockUsdc)), amount);
    }

    function test_checkBalance_sumsAllComponents() public {
        // Set up remote balance
        _completeDepositFlow(2000e6);

        // Add local USDC
        _mintUsdc(address(crossChainMasterStrategy), 500e6);

        uint256 expected = 2000e6 + 500e6; // remote + local
        assertEq(crossChainMasterStrategy.checkBalance(address(mockUsdc)), expected);
    }

    function test_checkBalance_RevertWhen_unsupportedAsset() public {
        vm.expectRevert("Unsupported asset");
        crossChainMasterStrategy.checkBalance(address(0xdead));
    }

    // --- supportsAsset ---

    function test_supportsAsset_trueForUsdc() public view {
        assertTrue(crossChainMasterStrategy.supportsAsset(address(mockUsdc)));
    }

    function test_supportsAsset_falseForOther() public view {
        assertFalse(crossChainMasterStrategy.supportsAsset(address(0xdead)));
    }

    // --- isTransferPending ---

    function test_isTransferPending_falseInitially() public view {
        assertFalse(crossChainMasterStrategy.isTransferPending());
    }

    function test_isTransferPending_trueAfterDeposit() public {
        _depositAsVault(100e6);
        assertTrue(crossChainMasterStrategy.isTransferPending());
    }

    function test_isTransferPending_falseAfterProcessing() public {
        _completeDepositFlow(100e6);
        assertFalse(crossChainMasterStrategy.isTransferPending());
    }

    // --- isNonceProcessed ---

    function test_isNonceProcessed_trueForZero() public view {
        assertTrue(crossChainMasterStrategy.isNonceProcessed(0));
    }

    function test_isNonceProcessed_falseForUnprocessed() public view {
        assertFalse(crossChainMasterStrategy.isNonceProcessed(1));
    }

    function test_isNonceProcessed_trueAfterFlowCompletion() public {
        _completeDepositFlow(100e6);
        assertTrue(crossChainMasterStrategy.isNonceProcessed(1));
    }

    // --- constants ---

    function test_constants() public view {
        assertEq(crossChainMasterStrategy.MAX_TRANSFER_AMOUNT(), 10_000_000e6);
        assertEq(crossChainMasterStrategy.MIN_TRANSFER_AMOUNT(), 1e6);
    }

    // --- immutables ---

    function test_immutables() public view {
        assertEq(address(crossChainMasterStrategy.cctpMessageTransmitter()), address(cctpMessageTransmitterMock));
        assertEq(address(crossChainMasterStrategy.cctpTokenMessenger()), address(cctpTokenMessengerMock));
        assertEq(crossChainMasterStrategy.usdcToken(), address(mockUsdc));
        assertEq(crossChainMasterStrategy.peerUsdcToken(), address(peerUsdc));
        assertEq(crossChainMasterStrategy.peerDomainID(), 6);
        assertEq(crossChainMasterStrategy.peerStrategy(), peerStrategy);
    }
}
