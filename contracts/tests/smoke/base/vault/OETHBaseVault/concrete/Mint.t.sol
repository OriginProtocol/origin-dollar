// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHBaseVault_Shared_Test} from "tests/smoke/base/vault/OETHBaseVault/shared/Shared.t.sol";

contract Smoke_Concrete_OETHBaseVault_Mint_Test is Smoke_OETHBaseVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- MINT
    //////////////////////////////////////////////////////

    function test_mint_increasesTotalValue() public {
        uint256 totalValueBefore = oethBaseVault.totalValue();
        _mintOETHBase(alice, 1 ether);
        uint256 totalValueAfter = oethBaseVault.totalValue();

        assertApproxEqAbs(totalValueAfter - totalValueBefore, 1 ether, 0.01 ether);
    }

    function test_mint_wethDebitedFromUser() public {
        deal(address(weth), alice, 1 ether);
        vm.startPrank(alice);
        weth.approve(address(oethBaseVault), 1 ether);
        oethBaseVault.mint(1 ether);
        vm.stopPrank();

        assertEq(weth.balanceOf(alice), 0);
    }

    function test_mint_vaultReceivesWeth() public {
        uint256 vaultWethBefore = weth.balanceOf(address(oethBaseVault));
        _mintOETHBase(alice, 1 ether);
        uint256 vaultWethAfter = weth.balanceOf(address(oethBaseVault));

        assertGe(vaultWethAfter, vaultWethBefore);
    }
}
