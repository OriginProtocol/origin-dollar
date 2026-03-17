// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETH_Shared_Test} from "tests/smoke/token/OETH/shared/Shared.t.sol";

contract Smoke_Concrete_OETH_Mint_Test is Smoke_OETH_Shared_Test {
    function test_mint_producesOETH() public {
        uint256 balanceBefore = oeth.balanceOf(alice);
        _mintOETH(alice, 1e18);
        uint256 balanceAfter = oeth.balanceOf(alice);

        assertApproxEqAbs(balanceAfter - balanceBefore, 1e18, 1e16);
    }

    function test_mint_increasesTotalSupply() public {
        uint256 totalSupplyBefore = oeth.totalSupply();
        _mintOETH(alice, 1e18);
        uint256 totalSupplyAfter = oeth.totalSupply();

        // totalSupply increases by at least the minted amount (may be more due to rebase during mint)
        assertGe(totalSupplyAfter - totalSupplyBefore, 1e18 - 1e16);
    }

    function test_mint_supplyInvariant() public {
        _mintOETH(alice, 1e18);
        _assertSupplyInvariant();
    }
}
