// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Smoke_CrossChainRemoteStrategyHyperEVM_Shared_Test } from "../shared/Shared.t.sol";
import { HyperEVM, CrossChain } from "tests/utils/Addresses.sol";

contract Smoke_CrossChainRemoteStrategyHyperEVM_ViewFunctions_Test is
    Smoke_CrossChainRemoteStrategyHyperEVM_Shared_Test
{
    function test_platformAddress() public view {
        assertTrue(
            crossChainRemoteStrategy.platformAddress() != address(0),
            "platformAddress should not be address(0)"
        );
    }

    function test_supportsAsset() public view {
        assertTrue(
            crossChainRemoteStrategy.supportsAsset(HyperEVM.USDC),
            "Should support USDC"
        );
    }

    function test_usdcToken() public view {
        assertEq(
            address(crossChainRemoteStrategy.usdcToken()),
            HyperEVM.USDC,
            "usdcToken should be HyperEVM USDC"
        );
    }

    function test_peerDomainID() public view {
        assertEq(
            crossChainRemoteStrategy.peerDomainID(),
            0,
            "peerDomainID should be 0 (Ethereum)"
        );
    }

    function test_peerStrategy() public view {
        assertEq(
            crossChainRemoteStrategy.peerStrategy(),
            address(crossChainRemoteStrategy),
            "peerStrategy should match strategy address (CREATE2 same address)"
        );
    }

    function test_checkBalance() public view {
        // Should not revert - just verify it returns a valid value
        crossChainRemoteStrategy.checkBalance(HyperEVM.USDC);
    }

    function test_cctpMessageTransmitter() public view {
        assertEq(
            address(crossChainRemoteStrategy.cctpMessageTransmitter()),
            CrossChain.CCTPMessageTransmitterV2,
            "cctpMessageTransmitter should be CCTPMessageTransmitterV2"
        );
    }

    function test_cctpTokenMessenger() public view {
        assertEq(
            address(crossChainRemoteStrategy.cctpTokenMessenger()),
            CrossChain.CCTPTokenMessengerV2,
            "cctpTokenMessenger should be CCTPTokenMessengerV2"
        );
    }

    function test_vaultAddress() public view {
        assertEq(
            crossChainRemoteStrategy.vaultAddress(),
            address(0),
            "vaultAddress should be address(0) for remote strategy"
        );
    }
}
