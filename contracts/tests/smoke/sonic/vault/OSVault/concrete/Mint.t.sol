// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OSVault_Shared_Test} from "tests/smoke/sonic/vault/OSVault/shared/Shared.t.sol";

contract Smoke_Concrete_OSVault_Mint_Test is Smoke_OSVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- MINT
    //////////////////////////////////////////////////////

    function test_mint_increasesTotalValue() public {
        uint256 totalValueBefore = oSonicVault.totalValue();
        _mintOSonic(alice, 1000 ether);
        uint256 totalValueAfter = oSonicVault.totalValue();

        assertApproxEqAbs(totalValueAfter - totalValueBefore, 1000 ether, 1 ether);
    }

    function test_mint_wsDebitedFromUser() public {
        deal(address(wrappedSonic), alice, 1000 ether);
        vm.startPrank(alice);
        wrappedSonic.approve(address(oSonicVault), 1000 ether);
        oSonicVault.mint(1000 ether);
        vm.stopPrank();

        assertEq(wrappedSonic.balanceOf(alice), 0);
    }

    function test_mint_vaultReceivesWs() public {
        uint256 vaultWsBefore = wrappedSonic.balanceOf(address(oSonicVault));
        _mintOSonic(alice, 1000 ether);
        uint256 vaultWsAfter = wrappedSonic.balanceOf(address(oSonicVault));

        assertGe(vaultWsAfter, vaultWsBefore);
    }
}
