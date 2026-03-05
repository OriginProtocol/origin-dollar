// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OETHVault_Shared_Test} from "tests/unit/vault/OETHVault/shared/Shared.t.sol";

contract Unit_Fuzz_OETHVault_Mint_Test is Unit_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- MINT FUZZ TESTS
    //////////////////////////////////////////////////////

    /// @notice alice OETH balance equals mint amount (no scaling since WETH is 18 dec)
    function testFuzz_mint_oethBalanceMatchesAmount(uint256 amount) public {
        amount = bound(amount, 1, 1e24);

        _mintOETH(alice, amount);

        assertEq(oeth.balanceOf(alice), amount);
    }

    /// @notice vault WETH balance increases by exact amount
    function testFuzz_mint_vaultWETHBalanceIncrease(uint256 amount) public {
        amount = bound(amount, 1, 1e24);

        uint256 vaultBefore = weth.balanceOf(address(oethVault));
        _mintOETH(alice, amount);

        assertEq(weth.balanceOf(address(oethVault)), vaultBefore + amount);
    }

    /// @notice totalSupply increases by amount
    function testFuzz_mint_totalSupplyIncrease(uint256 amount) public {
        amount = bound(amount, 1, 1e24);

        uint256 supplyBefore = oeth.totalSupply();
        _mintOETH(alice, amount);

        assertEq(oeth.totalSupply(), supplyBefore + amount);
    }

    /// @notice totalValue increases by amount
    function testFuzz_mint_totalValueIncrease(uint256 amount) public {
        amount = bound(amount, 1, 1e24);

        uint256 valueBefore = oethVault.totalValue();
        _mintOETH(alice, amount);

        assertEq(oethVault.totalValue(), valueBefore + amount);
    }

    /// @notice mint then full withdrawal returns exact same WETH (no dust loss with 18-dec asset)
    function testFuzz_mint_roundTrip_exactRecovery(uint256 amount) public {
        amount = bound(amount, 1, 1e24);

        _mintOETH(alice, amount);
        uint256 oethBal = oeth.balanceOf(alice);

        vm.prank(alice);
        oethVault.requestWithdrawal(oethBal);

        vm.warp(block.timestamp + DELAY_PERIOD);

        uint256 wethBefore = weth.balanceOf(alice);
        vm.prank(alice);
        oethVault.claimWithdrawal(0);

        assertEq(weth.balanceOf(alice) - wethBefore, amount);
    }

    /// @notice two sequential mints produce additive OETH balance
    function testFuzz_mint_multipleMints_additive(uint256 a1, uint256 a2) public {
        a1 = bound(a1, 1, 5e23);
        a2 = bound(a2, 1, 5e23);

        _mintOETH(alice, a1);
        _mintOETH(alice, a2);

        assertEq(oeth.balanceOf(alice), a1 + a2);
    }
}
