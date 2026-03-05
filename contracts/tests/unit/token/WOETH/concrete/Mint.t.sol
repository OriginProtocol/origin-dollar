// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_WOETH_Shared_Test} from "tests/unit/token/WOETH/shared/Shared.t.sol";

contract Unit_Concrete_WOETH_Mint_Test is Unit_WOETH_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- MINT (ERC4626: mint exact shares)
    //////////////////////////////////////////////////////

    function test_mint_basic() public {
        _mintOETH(alice, 10e18);

        vm.startPrank(alice);
        oeth.approve(address(woeth), 10e18);
        uint256 assets = woeth.mint(10e18, alice);
        vm.stopPrank();

        // At 1:1, minting 10 shares costs 10 OETH
        assertEq(assets, 10e18);
        assertEq(woeth.balanceOf(alice), 10e18);
    }

    function test_mint_toDifferentReceiver() public {
        _mintOETH(alice, 10e18);

        vm.startPrank(alice);
        oeth.approve(address(woeth), 10e18);
        uint256 assets = woeth.mint(10e18, bobby);
        vm.stopPrank();

        assertEq(woeth.balanceOf(bobby), 10e18);
        assertEq(woeth.balanceOf(alice), 0);
        assertEq(assets, 10e18);
    }

    function test_mint_afterRebase() public {
        _mintAndDeposit(alice, 10e18);
        _rebase(10e18);

        // After rebase, minting 1 share costs more than 1 OETH
        _mintOETH(bobby, 10e18);
        vm.startPrank(bobby);
        oeth.approve(address(woeth), 10e18);
        uint256 assets = woeth.mint(1e18, bobby);
        vm.stopPrank();

        assertGt(assets, 1e18);
    }

    function test_mint_RevertWhen_noApproval() public {
        _mintOETH(alice, 10e18);

        vm.prank(alice);
        vm.expectRevert("Allowance exceeded");
        woeth.mint(10e18, alice);
    }

    function test_mint_zeroShares() public {
        vm.prank(alice);
        uint256 assets = woeth.mint(0, alice);
        assertEq(assets, 0);
        assertEq(woeth.balanceOf(alice), 0);
    }
}
