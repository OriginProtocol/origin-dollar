// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_EthereumBridgeHelperModule_Shared_Test
} from "tests/unit/automation/EthereumBridgeHelperModule/shared/Shared.t.sol";

contract Unit_Concrete_EthereumBridgeHelperModule_Constructor_Test is Unit_EthereumBridgeHelperModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    //////////////////////////////////////////////////////

    function test_constructor_safeContractSet() public view {
        assertEq(address(ethereumBridgeHelperModule.safeContract()), address(mockSafe));
    }

    function test_constructor_safeHasAdminRole() public view {
        assertTrue(
            ethereumBridgeHelperModule.hasRole(ethereumBridgeHelperModule.DEFAULT_ADMIN_ROLE(), address(mockSafe))
        );
    }

    function test_constructor_vaultConstant() public view {
        assertEq(address(ethereumBridgeHelperModule.vault()), 0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab);
    }

    function test_constructor_wethConstant() public view {
        assertEq(address(ethereumBridgeHelperModule.weth()), 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    }

    function test_constructor_oethConstant() public view {
        assertEq(address(ethereumBridgeHelperModule.oeth()), 0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3);
    }

    function test_constructor_woethConstant() public view {
        assertEq(address(ethereumBridgeHelperModule.woeth()), 0xDcEe70654261AF21C44c093C300eD3Bb97b78192);
    }

    function test_constructor_ccipRouterConstant() public view {
        assertEq(address(ethereumBridgeHelperModule.CCIP_ROUTER()), 0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D);
    }

    function test_constructor_ccipBaseChainSelectorConstant() public view {
        assertEq(ethereumBridgeHelperModule.CCIP_BASE_CHAIN_SELECTOR(), 15971525489660198786);
    }
}
