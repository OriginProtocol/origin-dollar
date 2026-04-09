// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETHVault_Shared_Test} from "tests/smoke/mainnet/vault/OETHVault/shared/Shared.t.sol";

contract Smoke_Concrete_OETHVault_Mint_Test is Smoke_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- MINT
    //////////////////////////////////////////////////////

    function test_mint_increasesTotalValue() public {
        uint256 totalValueBefore = oethVault.totalValue();
        _mintOETH(alice, 1 ether);
        uint256 totalValueAfter = oethVault.totalValue();

        assertApproxEqAbs(totalValueAfter - totalValueBefore, 1 ether, 0.01 ether);
    }

    function test_mint_wethDebitedFromUser() public {
        deal(address(weth), alice, 1 ether);
        vm.startPrank(alice);
        weth.approve(address(oethVault), 1 ether);
        oethVault.mint(1 ether);
        vm.stopPrank();

        assertEq(weth.balanceOf(alice), 0);
    }

    function test_mint_vaultReceivesWeth() public {
        uint256 vaultWethBefore = weth.balanceOf(address(oethVault));
        _mintOETH(alice, 1 ether);
        uint256 vaultWethAfter = weth.balanceOf(address(oethVault));

        assertGe(vaultWethAfter, vaultWethBefore);
    }
}
