// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETHBaseVault_Shared_Test} from "tests/smoke/base/vault/OETHBaseVault/shared/Shared.t.sol";

// --- Project imports
import {CrossChain} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_OETHBaseVault_Rebase_Test is Smoke_OETHBaseVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REBASE
    //////////////////////////////////////////////////////

    function test_rebase_succeeds() public {
        vm.prank(governor);
        oethBaseVault.rebase();
    }

    function test_rebase_increasesTotalSupply() public {
        _mintOETHBase(alice, 1 ether);
        uint256 totalSupplyBefore = oethBase.totalSupply();

        _rebase(0.1 ether);

        assertGt(oethBase.totalSupply(), totalSupplyBefore);
    }

    function test_previewYield_returnsExpected() public {
        _mintOETHBase(alice, 1 ether);

        // Deal yield to vault and warp
        deal(address(weth), address(oethBaseVault), weth.balanceOf(address(oethBaseVault)) + 0.1 ether);
        vm.warp(block.timestamp + 1);

        // Preview should show pending yield
        uint256 preview = oethBaseVault.previewYield();
        assertGt(preview, 0);

        // After rebase, preview should be zero
        vm.prank(governor);
        oethBaseVault.rebase();
        uint256 previewAfter = oethBaseVault.previewYield();
        assertEq(previewAfter, 0);
    }

    //////////////////////////////////////////////////////
    /// --- REBASE AUTHORIZATION
    //////////////////////////////////////////////////////

    /// @dev The permissioned-rebase operator is the Talos relayer on every chain.
    function test_operatorAddr_isTalosRelayer() public view {
        assertEq(oethBaseVault.operatorAddr(), CrossChain.talosRelayer);
    }

    function test_rebase_asOperator() public {
        vm.prank(oethBaseVault.operatorAddr());
        oethBaseVault.rebase(); // Should not revert
    }

    function test_rebase_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller not authorized");
        oethBaseVault.rebase();
    }
}
