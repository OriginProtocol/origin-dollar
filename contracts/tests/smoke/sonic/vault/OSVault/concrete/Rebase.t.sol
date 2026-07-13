// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OSVault_Shared_Test} from "tests/smoke/sonic/vault/OSVault/shared/Shared.t.sol";

// --- Project imports
import {CrossChain} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_OSVault_Rebase_Test is Smoke_OSVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REBASE
    //////////////////////////////////////////////////////

    function test_rebase_succeeds() public {
        vm.prank(governor);
        oSonicVault.rebase();
    }

    function test_rebase_increasesTotalSupply() public {
        _mintOSonic(alice, 1000 ether);
        uint256 totalSupplyBefore = oSonic.totalSupply();

        _rebase(10 ether);

        assertGt(oSonic.totalSupply(), totalSupplyBefore);
    }

    function test_previewYield_returnsExpected() public {
        _mintOSonic(alice, 1000 ether);

        // Deal yield to vault and warp
        deal(address(wrappedSonic), address(oSonicVault), wrappedSonic.balanceOf(address(oSonicVault)) + 10 ether);
        vm.warp(block.timestamp + 1);

        // Preview should show pending yield
        uint256 preview = oSonicVault.previewYield();
        assertGt(preview, 0);

        // After rebase, preview should be zero
        vm.prank(governor);
        oSonicVault.rebase();
        uint256 previewAfter = oSonicVault.previewYield();
        assertEq(previewAfter, 0);
    }

    //////////////////////////////////////////////////////
    /// --- REBASE AUTHORIZATION
    //////////////////////////////////////////////////////

    /// @dev The permissioned-rebase operator is the Talos relayer on every chain.
    function test_operatorAddr_isTalosRelayer() public view {
        assertEq(oSonicVault.operatorAddr(), CrossChain.talosRelayer);
    }

    function test_rebase_asOperator() public {
        vm.prank(oSonicVault.operatorAddr());
        oSonicVault.rebase(); // Should not revert
    }

    function test_rebase_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller not authorized");
        oSonicVault.rebase();
    }
}
