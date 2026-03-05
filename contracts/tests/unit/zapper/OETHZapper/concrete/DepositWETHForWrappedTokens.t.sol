// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OETHZapper_Shared_Test} from "tests/unit/zapper/OETHZapper/shared/Shared.t.sol";

contract Unit_Concrete_OETHZapper_DepositWETHForWrappedTokens_Test is Unit_OETHZapper_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- depositWETHForWrappedTokens()
    //////////////////////////////////////////////////////

    function test_depositWETHForWrappedTokens_basic() public {
        _dealWETH(alice, 1 ether);

        vm.startPrank(alice);
        weth.approve(address(oethZapper), 1 ether);
        uint256 woethReceived = oethZapper.depositWETHForWrappedTokens(1 ether, 0);
        vm.stopPrank();

        assertEq(woethReceived, 1 ether);
        assertEq(woeth.balanceOf(alice), 1 ether);
        assertEq(weth.balanceOf(alice), 0);
    }

    function test_depositWETHForWrappedTokens_emitsZap() public {
        _dealWETH(alice, 1 ether);

        vm.startPrank(alice);
        weth.approve(address(oethZapper), 1 ether);

        vm.expectEmit(true, true, false, true, address(oethZapper));
        emit Zap(alice, address(weth), 1 ether);
        oethZapper.depositWETHForWrappedTokens(1 ether, 0);
        vm.stopPrank();
    }

    function test_depositWETHForWrappedTokens_RevertWhen_slippageTooHigh() public {
        _dealWETH(alice, 1 ether);

        vm.startPrank(alice);
        weth.approve(address(oethZapper), 1 ether);

        vm.expectRevert("Zapper: not enough minted");
        oethZapper.depositWETHForWrappedTokens(1 ether, 2 ether);
        vm.stopPrank();
    }

    function test_depositWETHForWrappedTokens_RevertWhen_noApproval() public {
        _dealWETH(alice, 1 ether);

        vm.prank(alice);
        vm.expectRevert();
        oethZapper.depositWETHForWrappedTokens(1 ether, 0);
    }

    //////////////////////////////////////////////////////
    /// --- EVENTS
    //////////////////////////////////////////////////////
    event Zap(address indexed minter, address indexed asset, uint256 amount);
}
