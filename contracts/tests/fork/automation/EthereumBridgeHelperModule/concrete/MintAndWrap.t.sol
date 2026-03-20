// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_EthereumBridgeHelperModule_Shared_Test
} from "tests/fork/automation/EthereumBridgeHelperModule/shared/Shared.t.sol";

contract Fork_Concrete_EthereumBridgeHelperModule_MintAndWrap_Test is Fork_EthereumBridgeHelperModule_Shared_Test {
    function test_mintAndWrap() public {
        oethVault.rebase();

        uint256 wethAmount = 1 ether;
        _fundSafeWithWETH(1.1 ether);

        uint256 woethAmount = woeth.convertToShares(wethAmount);

        uint256 supplyBefore = oeth.totalSupply();
        uint256 wethBalanceBefore = weth.balanceOf(safeSigner);
        uint256 woethSupplyBefore = woeth.totalSupply();

        vm.prank(safeSigner);
        ethereumBridgeHelperModule.mintAndWrap(wethAmount, false);

        uint256 supplyAfter = oeth.totalSupply();
        uint256 wethBalanceAfter = weth.balanceOf(safeSigner);
        uint256 woethSupplyAfter = woeth.totalSupply();

        assertGe(supplyAfter, supplyBefore + wethAmount, "OETH supply should increase");
        assertApproxEqRel(wethBalanceBefore, wethBalanceAfter + wethAmount, 0.01e18, "WETH balance should decrease");
        assertApproxEqRel(woethSupplyAfter, woethSupplyBefore + woethAmount, 0.01e18, "wOETH supply should increase");
    }
}
