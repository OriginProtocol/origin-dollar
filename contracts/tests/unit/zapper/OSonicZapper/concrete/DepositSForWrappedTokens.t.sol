// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OSonicZapper_Shared_Test} from "tests/unit/zapper/OSonicZapper/shared/Shared.t.sol";

contract Unit_Concrete_OSonicZapper_DepositSForWrappedTokens_Test is Unit_OSonicZapper_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- depositSForWrappedTokens()
    //////////////////////////////////////////////////////

    function test_depositSForWrappedTokens_basic() public {
        _dealS(alice, 1 ether);

        vm.prank(alice);
        uint256 wosReceived = oSonicZapper.depositSForWrappedTokens{value: 1 ether}(0);

        assertEq(wosReceived, 1 ether);
        assertEq(woSonic.balanceOf(alice), 1 ether);
        assertEq(oSonic.balanceOf(alice), 0);
    }

    function test_depositSForWrappedTokens_emitsZap() public {
        _dealS(alice, 1 ether);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(oSonicZapper));
        emit Zap(alice, ETH_MARKER, 1 ether);
        oSonicZapper.depositSForWrappedTokens{value: 1 ether}(0);
    }

    function test_depositSForWrappedTokens_RevertWhen_slippageTooHigh() public {
        _dealS(alice, 1 ether);

        vm.prank(alice);
        vm.expectRevert("Zapper: not enough minted");
        oSonicZapper.depositSForWrappedTokens{value: 1 ether}(2 ether);
    }

    //////////////////////////////////////////////////////
    /// --- EVENTS
    //////////////////////////////////////////////////////
    event Zap(address indexed minter, address indexed asset, uint256 amount);
}
