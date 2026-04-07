// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OETHZapper_Shared_Test} from "tests/unit/zapper/OETHZapper/shared/Shared.t.sol";
import {IOETHZapper} from "contracts/interfaces/IOETHZapper.sol";

contract Unit_Concrete_OETHZapper_Deposit_Test is Unit_OETHZapper_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- deposit()
    //////////////////////////////////////////////////////

    function test_deposit_basic() public {
        _dealETH(alice, 1 ether);

        vm.prank(alice);
        uint256 oethReceived = oethZapper.deposit{value: 1 ether}();

        assertEq(oethReceived, 1 ether);
        assertEq(oeth.balanceOf(alice), 1 ether);
    }

    function test_deposit_emitsZap() public {
        _dealETH(alice, 1 ether);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(oethZapper));
        emit IOETHZapper.Zap(alice, ETH_MARKER, 1 ether);
        oethZapper.deposit{value: 1 ether}();
    }

    function test_deposit_viaReceive() public {
        _dealETH(alice, 1 ether);

        vm.prank(alice);
        (bool success,) = address(oethZapper).call{value: 1 ether}("");
        assertTrue(success);

        assertEq(oeth.balanceOf(alice), 1 ether);
    }

    function test_deposit_withExistingBalance() public {
        // Send some ETH to zapper first (simulating leftover)
        _dealETH(address(this), 0.5 ether);
        (bool success,) = address(oethZapper).call{value: 0.5 ether}("");
        assertTrue(success);
        // receive() will deposit, but let's use a different approach:
        // deal ETH directly to the contract
        vm.deal(address(oethZapper), 0.5 ether);

        _dealETH(alice, 1 ether);

        vm.prank(alice);
        uint256 oethReceived = oethZapper.deposit{value: 1 ether}();

        // Should mint 1.5 OETH (1 ETH sent + 0.5 ETH existing balance)
        assertEq(oethReceived, 1.5 ether);
        assertEq(oeth.balanceOf(alice), 1.5 ether);
    }

    function test_deposit_RevertWhen_vaultMintsNothing() public {
        _dealETH(alice, 1 ether);

        // Mock vault.mint to be a no-op (doesn't actually mint oTokens)
        vm.mockCall(address(oethVault), abi.encodeWithSignature("mint(uint256)"), abi.encode());

        vm.prank(alice);
        vm.expectRevert("Zapper: not enough minted");
        oethZapper.deposit{value: 1 ether}();
    }

    function test_deposit_RevertWhen_transferFails() public {
        _dealETH(alice, 1 ether);

        // Mock oToken.transfer to return false
        vm.mockCall(address(oeth), abi.encodeWithSelector(oeth.transfer.selector), abi.encode(false));

        vm.prank(alice);
        vm.expectRevert();
        oethZapper.deposit{value: 1 ether}();
    }
}
