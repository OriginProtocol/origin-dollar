// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Smoke_EthereumBridgeHelperModule_Shared_Test
} from "tests/smoke/mainnet/automation/EthereumBridgeHelperModule/shared/Shared.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_EthereumBridgeHelperModule_Test is Smoke_EthereumBridgeHelperModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW TESTS
    //////////////////////////////////////////////////////

    function test_vault() public view {
        assertEq(address(ethereumBridgeHelperModule.vault()), address(vault));
    }

    function test_weth() public view {
        assertEq(address(ethereumBridgeHelperModule.weth()), Mainnet.WETH);
    }

    function test_oeth() public view {
        assertEq(address(ethereumBridgeHelperModule.oeth()), resolver.resolve("OETH_PROXY"));
    }

    function test_woeth() public view {
        assertEq(address(ethereumBridgeHelperModule.woeth()), address(woeth));
    }

    function test_safeContract() public view {
        assertNotEq(address(ethereumBridgeHelperModule.safeContract()), address(0));
    }

    function test_CCIP_ROUTER() public view {
        assertEq(address(ethereumBridgeHelperModule.CCIP_ROUTER()), Mainnet.ccipRouterMainnet);
    }

    function test_CCIP_BASE_CHAIN_SELECTOR() public view {
        assertEq(ethereumBridgeHelperModule.CCIP_BASE_CHAIN_SELECTOR(), 15971525489660198786);
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE TESTS
    //////////////////////////////////////////////////////

    function test_mintAndWrap() public {
        uint256 wethAmount = 1e18;
        deal(address(weth), safe, wethAmount);

        uint256 woethBefore = woeth.balanceOf(safe);

        vm.prank(operator);
        uint256 woethMinted = ethereumBridgeHelperModule.mintAndWrap(wethAmount, false);

        uint256 woethAfter = woeth.balanceOf(safe);
        assertEq(woethAfter - woethBefore, woethMinted, "wOETH delta should match return value");
        assertGt(woethMinted, 0, "Should have minted some wOETH");
        assertEq(weth.balanceOf(safe), 0, "All WETH should be consumed");
    }

    function test_bridgeWOETHToBase() public {
        uint256 woethAmount = 1 ether;
        deal(address(woeth), safe, woethAmount);
        vm.deal(safe, 1 ether); // for CCIP gas fee

        uint256 safeWoethBefore = woeth.balanceOf(safe);

        vm.prank(operator);
        ethereumBridgeHelperModule.bridgeWOETHToBase(woethAmount);

        assertLt(woeth.balanceOf(safe), safeWoethBefore, "Safe wOETH should decrease after bridge");
    }

    function test_bridgeWETHToBase() public {
        uint256 wethAmount = 1 ether;
        _fundWithWETH(safe, wethAmount);
        vm.deal(safe, 1 ether); // for CCIP gas fee

        uint256 safeWethBefore = weth.balanceOf(safe);

        vm.prank(operator);
        ethereumBridgeHelperModule.bridgeWETHToBase(wethAmount);

        assertLt(weth.balanceOf(safe), safeWethBefore, "Safe WETH should decrease after bridge");
    }

    function test_mintWrapAndBridgeToBase() public {
        uint256 wethAmount = 1 ether;
        _fundWithWETH(safe, wethAmount);
        vm.deal(safe, 1 ether); // for CCIP gas fee

        uint256 safeWethBefore = weth.balanceOf(safe);
        uint256 safeWoethBefore = woeth.balanceOf(safe);

        vm.prank(operator);
        ethereumBridgeHelperModule.mintWrapAndBridgeToBase(wethAmount, false);

        assertLt(weth.balanceOf(safe), safeWethBefore, "Safe WETH should decrease");
        assertEq(woeth.balanceOf(safe), safeWoethBefore, "Safe wOETH should be unchanged");
    }
}
