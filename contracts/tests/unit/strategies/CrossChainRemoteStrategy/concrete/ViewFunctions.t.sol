// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_CrossChainRemoteStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_Concrete_CrossChainRemoteStrategy_ViewFunctions_Test is Unit_CrossChainRemoteStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    // --- checkBalance ---

    function test_checkBalance_returnsZeroInitially() public view {
        assertEq(crossChainRemoteStrategy.checkBalance(address(mockUsdc)), 0);
    }

    function test_checkBalance_includesERC4626Balance() public {
        uint256 amount = 2000e6;
        _depositAsGovernor(amount);

        assertEq(crossChainRemoteStrategy.checkBalance(address(mockUsdc)), amount);
    }

    function test_checkBalance_includesLocalUsdcBalance() public {
        uint256 amount = 500e6;
        _mintUsdc(address(crossChainRemoteStrategy), amount);

        assertEq(crossChainRemoteStrategy.checkBalance(address(mockUsdc)), amount);
    }

    function test_checkBalance_sumsBothComponents() public {
        uint256 depositAmount = 1000e6;
        uint256 looseAmount = 300e6;

        _depositAsGovernor(depositAmount);
        _mintUsdc(address(crossChainRemoteStrategy), looseAmount);

        assertEq(crossChainRemoteStrategy.checkBalance(address(mockUsdc)), depositAmount + looseAmount);
    }

    function test_checkBalance_RevertWhen_wrongAsset() public {
        vm.expectRevert("Unexpected asset address");
        crossChainRemoteStrategy.checkBalance(address(0xdead));
    }

    // --- supportsAsset ---

    function test_supportsAsset_trueForUsdc() public view {
        assertTrue(crossChainRemoteStrategy.supportsAsset(address(mockUsdc)));
    }

    function test_supportsAsset_falseForOther() public view {
        assertFalse(crossChainRemoteStrategy.supportsAsset(address(0xdead)));
    }

    // --- isTransferPending ---

    function test_isTransferPending_falseInitially() public view {
        assertFalse(crossChainRemoteStrategy.isTransferPending());
    }

    // --- isNonceProcessed ---

    function test_isNonceProcessed_trueForZero() public view {
        assertTrue(crossChainRemoteStrategy.isNonceProcessed(0));
    }

    function test_isNonceProcessed_falseForUnprocessed() public view {
        assertFalse(crossChainRemoteStrategy.isNonceProcessed(1));
    }

    // --- immutables ---

    function test_immutables() public view {
        assertEq(address(crossChainRemoteStrategy.cctpMessageTransmitter()), address(cctpMessageTransmitterMock));
        assertEq(address(crossChainRemoteStrategy.cctpTokenMessenger()), address(cctpTokenMessengerMock));
        assertEq(crossChainRemoteStrategy.usdcToken(), address(mockUsdc));
        assertEq(crossChainRemoteStrategy.peerUsdcToken(), address(peerUsdc));
        assertEq(crossChainRemoteStrategy.peerDomainID(), 0);
        assertEq(crossChainRemoteStrategy.peerStrategy(), peerStrategy);
        assertEq(crossChainRemoteStrategy.platformAddress(), address(mockERC4626Vault));
        assertEq(address(crossChainRemoteStrategy.shareToken()), address(mockERC4626Vault));
        assertEq(address(crossChainRemoteStrategy.assetToken()), address(mockUsdc));
    }
}
