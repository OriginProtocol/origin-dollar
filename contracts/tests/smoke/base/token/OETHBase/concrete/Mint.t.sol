// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHBase_Shared_Test} from "tests/smoke/base/token/OETHBase/shared/Shared.t.sol";

contract Smoke_Concrete_OETHBase_Mint_Test is Smoke_OETHBase_Shared_Test {
    function test_mint_producesOETHBase() public {
        uint256 balanceBefore = oethBase.balanceOf(alice);
        _mintOETHBase(alice, 1e18);
        uint256 balanceAfter = oethBase.balanceOf(alice);

        assertApproxEqAbs(balanceAfter - balanceBefore, 1e18, 1e16);
    }

    function test_mint_increasesTotalSupply() public {
        uint256 totalSupplyBefore = oethBase.totalSupply();
        _mintOETHBase(alice, 1e18);
        uint256 totalSupplyAfter = oethBase.totalSupply();

        // totalSupply increases by at least the minted amount (may be more due to rebase during mint)
        assertGe(totalSupplyAfter - totalSupplyBefore, 1e18 - 1e16);
    }

    function test_mint_supplyInvariant() public {
        _mintOETHBase(alice, 1e18);
        _assertSupplyInvariant();
    }
}
