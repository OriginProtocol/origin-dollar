// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHBaseVault_Shared_Test} from "tests/smoke/base/vault/OETHBaseVault/shared/Shared.t.sol";

contract Smoke_Concrete_OETHBaseVault_Rebase_Test is Smoke_OETHBaseVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- REBASE
    //////////////////////////////////////////////////////

    function test_rebase_succeeds() public {
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
        oethBaseVault.rebase();
        uint256 previewAfter = oethBaseVault.previewYield();
        assertEq(previewAfter, 0);
    }
}
