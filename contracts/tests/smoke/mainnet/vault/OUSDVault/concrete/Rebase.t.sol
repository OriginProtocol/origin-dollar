// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OUSDVault_Shared_Test} from "tests/smoke/mainnet/vault/OUSDVault/shared/Shared.t.sol";

// --- Project imports
import {CrossChain} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_OUSDVault_Rebase_Test is Smoke_OUSDVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REBASE
    //////////////////////////////////////////////////////

    function test_rebase_succeeds() public {
        vm.prank(governor);
        ousdVault.rebase();
    }

    function test_rebase_increasesTotalSupply() public {
        _mintOUSD(alice, 1000e6);
        uint256 totalSupplyBefore = ousd.totalSupply();

        _rebase(100e6);

        assertGt(ousd.totalSupply(), totalSupplyBefore);
    }

    function test_previewYield_returnsExpected() public {
        _mintOUSD(alice, 1000e6);

        // Deal yield to vault and warp
        deal(address(usdc), address(ousdVault), usdc.balanceOf(address(ousdVault)) + 100e6);
        vm.warp(block.timestamp + 1);

        // Preview should show pending yield
        uint256 preview = ousdVault.previewYield();
        assertGt(preview, 0);

        // After rebase, preview should be zero
        vm.prank(governor);
        ousdVault.rebase();
        uint256 previewAfter = ousdVault.previewYield();
        assertEq(previewAfter, 0);
    }

    //////////////////////////////////////////////////////
    /// --- REBASE AUTHORIZATION
    //////////////////////////////////////////////////////

    /// @dev The permissioned-rebase operator is the Talos relayer on every chain.
    function test_operatorAddr_isTalosRelayer() public view {
        assertEq(ousdVault.operatorAddr(), CrossChain.talosRelayer);
    }

    function test_rebase_asOperator() public {
        vm.prank(ousdVault.operatorAddr());
        ousdVault.rebase(); // Should not revert
    }

    function test_rebase_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller not authorized");
        ousdVault.rebase();
    }
}
