// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_BaseBridgeHelperModule_Shared_Test
} from "tests/unit/automation/BaseBridgeHelperModule/shared/Shared.t.sol";

contract Unit_Concrete_BaseBridgeHelperModule_Constructor_Test is Unit_BaseBridgeHelperModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    //////////////////////////////////////////////////////

    function test_constructor_safeContractSet() public view {
        assertEq(address(baseBridgeHelperModule.safeContract()), address(mockSafe));
    }

    function test_constructor_safeHasAdminRole() public view {
        assertTrue(baseBridgeHelperModule.hasRole(baseBridgeHelperModule.DEFAULT_ADMIN_ROLE(), address(mockSafe)));
    }

    function test_constructor_vaultConstant() public view {
        assertEq(address(baseBridgeHelperModule.vault()), 0x98a0CbeF61bD2D21435f433bE4CD42B56B38CC93);
    }

    function test_constructor_wethConstant() public view {
        assertEq(address(baseBridgeHelperModule.weth()), 0x4200000000000000000000000000000000000006);
    }

    function test_constructor_oethbConstant() public view {
        assertEq(address(baseBridgeHelperModule.oethb()), 0xDBFeFD2e8460a6Ee4955A68582F85708BAEA60A3);
    }

    function test_constructor_bridgedWOETHConstant() public view {
        assertEq(address(baseBridgeHelperModule.bridgedWOETH()), 0xD8724322f44E5c58D7A815F542036fb17DbbF839);
    }

    function test_constructor_bridgedWOETHStrategyConstant() public view {
        assertEq(address(baseBridgeHelperModule.bridgedWOETHStrategy()), 0x80c864704DD06C3693ed5179190786EE38ACf835);
    }

    function test_constructor_ccipRouterConstant() public view {
        assertEq(address(baseBridgeHelperModule.CCIP_ROUTER()), 0x881e3A65B4d4a04dD529061dd0071cf975F58bCD);
    }

    function test_constructor_ccipEthereumChainSelectorConstant() public view {
        assertEq(baseBridgeHelperModule.CCIP_ETHEREUM_CHAIN_SELECTOR(), 5009297550715157269);
    }
}
