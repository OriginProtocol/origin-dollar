// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_CrossChainMasterStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Mainnet, CrossChain} from "tests/utils/Addresses.sol";

contract Smoke_CrossChainMasterStrategy_ViewFunctions_Test is Smoke_CrossChainMasterStrategy_Shared_Test {
    function test_vaultAddress() public view {
        assertEq(crossChainMasterStrategy.vaultAddress(), vaultAddr, "vaultAddress should match");
    }

    function test_platformAddress() public view {
        assertEq(crossChainMasterStrategy.platformAddress(), address(0), "platformAddress should be address(0)");
    }

    function test_supportsAsset() public view {
        assertTrue(crossChainMasterStrategy.supportsAsset(Mainnet.USDC), "Should support USDC");
        assertFalse(crossChainMasterStrategy.supportsAsset(Mainnet.WETH), "Should not support WETH");
    }

    function test_usdcToken() public view {
        assertEq(address(crossChainMasterStrategy.usdcToken()), Mainnet.USDC, "usdcToken should be Mainnet.USDC");
    }

    function test_peerDomainID() public view {
        assertEq(crossChainMasterStrategy.peerDomainID(), 6, "peerDomainID should be 6 (Base)");
    }

    function test_peerStrategy() public view {
        assertEq(
            crossChainMasterStrategy.peerStrategy(),
            address(crossChainMasterStrategy),
            "peerStrategy should match strategy address (CREATE2 same address)"
        );
    }

    function test_cctpMessageTransmitter() public view {
        assertEq(
            address(crossChainMasterStrategy.cctpMessageTransmitter()),
            CrossChain.CCTPMessageTransmitterV2,
            "cctpMessageTransmitter should be CCTPMessageTransmitterV2"
        );
    }

    function test_cctpTokenMessenger() public view {
        assertEq(
            address(crossChainMasterStrategy.cctpTokenMessenger()),
            CrossChain.CCTPTokenMessengerV2,
            "cctpTokenMessenger should be CCTPTokenMessengerV2"
        );
    }

    function test_checkBalance() public view {
        // Should not revert - just verify it returns a valid value
        crossChainMasterStrategy.checkBalance(Mainnet.USDC);
    }
}
