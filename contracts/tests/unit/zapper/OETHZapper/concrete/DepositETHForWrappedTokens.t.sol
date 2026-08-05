// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_OETHZapper_Shared_Test} from "tests/unit/zapper/OETHZapper/shared/Shared.t.sol";

// --- Project imports
import {IOETHZapper} from "contracts/interfaces/IOETHZapper.sol";

contract Unit_Concrete_OETHZapper_DepositETHForWrappedTokens_Test is Unit_OETHZapper_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- depositETHForWrappedTokens()
    //////////////////////////////////////////////////////

    function test_depositETHForWrappedTokens_basic() public {
        _dealETH(alice, 1 ether);

        vm.prank(alice);
        uint256 woethReceived = oethZapper.depositETHForWrappedTokens{value: 1 ether}(0);

        assertEq(woethReceived, 1 ether);
        assertEq(woeth.balanceOf(alice), 1 ether);
        assertEq(oeth.balanceOf(alice), 0);
    }

    function test_depositETHForWrappedTokens_emitsZap() public {
        _dealETH(alice, 1 ether);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(oethZapper));
        emit IOETHZapper.Zap(alice, ETH_MARKER, 1 ether);
        oethZapper.depositETHForWrappedTokens{value: 1 ether}(0);
    }

    function test_depositETHForWrappedTokens_RevertWhen_slippageTooHigh() public {
        _dealETH(alice, 1 ether);

        vm.prank(alice);
        vm.expectRevert("Zapper: not enough minted");
        oethZapper.depositETHForWrappedTokens{value: 1 ether}(2 ether);
    }
}
