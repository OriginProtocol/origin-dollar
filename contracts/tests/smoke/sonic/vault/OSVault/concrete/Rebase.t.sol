// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OSVault_Shared_Test} from "tests/smoke/sonic/vault/OSVault/shared/Shared.t.sol";

contract Smoke_Concrete_OSVault_Rebase_Test is Smoke_OSVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REBASE
    //////////////////////////////////////////////////////

    function test_rebase_succeeds() public {
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
        oSonicVault.rebase();
        uint256 previewAfter = oSonicVault.previewYield();
        assertEq(previewAfter, 0);
    }
}
