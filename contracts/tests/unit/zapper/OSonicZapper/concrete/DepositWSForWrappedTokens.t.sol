// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OSonicZapper_Shared_Test} from "tests/unit/zapper/OSonicZapper/shared/Shared.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_OSonicZapper_DepositWSForWrappedTokens_Test is Unit_OSonicZapper_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- depositWSForWrappedTokens()
    //////////////////////////////////////////////////////

    function test_depositWSForWrappedTokens_basic() public {
        _dealWS(alice, 1 ether);

        vm.startPrank(alice);
        IERC20(WS_ADDRESS).approve(address(oSonicZapper), 1 ether);
        uint256 wosReceived = oSonicZapper.depositWSForWrappedTokens(1 ether, 0);
        vm.stopPrank();

        assertEq(wosReceived, 1 ether);
        assertEq(woSonic.balanceOf(alice), 1 ether);
        assertEq(IERC20(WS_ADDRESS).balanceOf(alice), 0);
    }

    function test_depositWSForWrappedTokens_emitsZap() public {
        _dealWS(alice, 1 ether);

        vm.startPrank(alice);
        IERC20(WS_ADDRESS).approve(address(oSonicZapper), 1 ether);

        vm.expectEmit(true, true, false, true, address(oSonicZapper));
        emit Zap(alice, WS_ADDRESS, 1 ether);
        oSonicZapper.depositWSForWrappedTokens(1 ether, 0);
        vm.stopPrank();
    }

    function test_depositWSForWrappedTokens_RevertWhen_slippageTooHigh() public {
        _dealWS(alice, 1 ether);

        vm.startPrank(alice);
        IERC20(WS_ADDRESS).approve(address(oSonicZapper), 1 ether);

        vm.expectRevert("Zapper: not enough minted");
        oSonicZapper.depositWSForWrappedTokens(1 ether, 2 ether);
        vm.stopPrank();
    }

    function test_depositWSForWrappedTokens_RevertWhen_noApproval() public {
        _dealWS(alice, 1 ether);

        vm.prank(alice);
        vm.expectRevert();
        oSonicZapper.depositWSForWrappedTokens(1 ether, 0);
    }

    //////////////////////////////////////////////////////
    /// --- EVENTS
    //////////////////////////////////////////////////////
    event Zap(address indexed minter, address indexed asset, uint256 amount);
}
