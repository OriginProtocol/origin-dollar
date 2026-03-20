// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OSonicZapper_Shared_Test} from "tests/unit/zapper/OSonicZapper/shared/Shared.t.sol";

contract Unit_Concrete_OSonicZapper_Deposit_Test is Unit_OSonicZapper_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- deposit()
    //////////////////////////////////////////////////////

    function test_deposit_basic() public {
        _dealS(alice, 1 ether);

        vm.prank(alice);
        uint256 osReceived = oSonicZapper.deposit{value: 1 ether}();

        assertEq(osReceived, 1 ether);
        assertEq(oSonic.balanceOf(alice), 1 ether);
    }

    function test_deposit_emitsZap() public {
        _dealS(alice, 1 ether);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(oSonicZapper));
        emit Zap(alice, ETH_MARKER, 1 ether);
        oSonicZapper.deposit{value: 1 ether}();
    }

    function test_deposit_viaReceive() public {
        _dealS(alice, 1 ether);

        vm.prank(alice);
        (bool success,) = address(oSonicZapper).call{value: 1 ether}("");
        assertTrue(success);

        assertEq(oSonic.balanceOf(alice), 1 ether);
    }

    function test_deposit_withExistingBalance() public {
        // Deal S directly to zapper contract
        vm.deal(address(oSonicZapper), 0.5 ether);

        _dealS(alice, 1 ether);

        vm.prank(alice);
        uint256 osReceived = oSonicZapper.deposit{value: 1 ether}();

        // Should mint 1.5 OS (1 S sent + 0.5 S existing balance)
        assertEq(osReceived, 1.5 ether);
        assertEq(oSonic.balanceOf(alice), 1.5 ether);
    }

    function test_deposit_RevertWhen_vaultMintsNothing() public {
        _dealS(alice, 1 ether);

        // Mock vault.mint to be a no-op (doesn't actually mint oTokens)
        vm.mockCall(
            address(oethVault),
            abi.encodeWithSignature("mint(uint256)"),
            abi.encode()
        );

        vm.prank(alice);
        vm.expectRevert("Zapper: not enough minted");
        oSonicZapper.deposit{value: 1 ether}();
    }

    function test_deposit_RevertWhen_transferFails() public {
        _dealS(alice, 1 ether);

        // Mock OS.transfer to return false
        vm.mockCall(
            address(oSonic),
            abi.encodeWithSelector(oSonic.transfer.selector),
            abi.encode(false)
        );

        vm.prank(alice);
        vm.expectRevert();
        oSonicZapper.deposit{value: 1 ether}();
    }

    //////////////////////////////////////////////////////
    /// --- EVENTS
    //////////////////////////////////////////////////////
    event Zap(address indexed minter, address indexed asset, uint256 amount);
}
