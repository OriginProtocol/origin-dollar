// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETHVault_Shared_Test} from "tests/smoke/mainnet/vault/OETHVault/shared/Shared.t.sol";

// --- Project imports
import {CrossChain} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_OETHVault_Rebase_Test is Smoke_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REBASE
    //////////////////////////////////////////////////////

    function test_rebase_succeeds() public {
        vm.prank(governor);
        oethVault.rebase();
    }

    function test_rebase_increasesTotalSupply() public {
        _mintOETH(alice, 1 ether);
        uint256 totalSupplyBefore = oeth.totalSupply();

        _rebase(0.1 ether);

        assertGt(oeth.totalSupply(), totalSupplyBefore);
    }

    function test_previewYield_returnsExpected() public {
        _mintOETH(alice, 1 ether);

        // Deal yield to vault and warp
        deal(address(weth), address(oethVault), weth.balanceOf(address(oethVault)) + 0.1 ether);
        vm.warp(block.timestamp + 1);

        // Preview should show pending yield
        uint256 preview = oethVault.previewYield();
        assertGt(preview, 0);

        // After rebase, preview should be zero
        vm.prank(governor);
        oethVault.rebase();
        uint256 previewAfter = oethVault.previewYield();
        assertEq(previewAfter, 0);
    }

    //////////////////////////////////////////////////////
    /// --- REBASE AUTHORIZATION
    //////////////////////////////////////////////////////

    /// @dev The permissioned-rebase operator is the Talos relayer on every chain.
    function test_operatorAddr_isTalosRelayer() public view {
        assertEq(oethVault.operatorAddr(), CrossChain.talosRelayer);
    }

    function test_rebase_asOperator() public {
        vm.prank(oethVault.operatorAddr());
        oethVault.rebase(); // Should not revert
    }

    function test_rebase_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller not authorized");
        oethVault.rebase();
    }
}
