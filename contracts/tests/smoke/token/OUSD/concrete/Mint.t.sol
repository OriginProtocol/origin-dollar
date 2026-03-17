// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OUSD_Shared_Test} from "tests/smoke/token/OUSD/shared/Shared.t.sol";

contract Smoke_Concrete_OUSD_Mint_Test is Smoke_OUSD_Shared_Test {
    function test_mint_producesOUSD() public {
        uint256 balanceBefore = ousd.balanceOf(alice);
        _mintOUSD(alice, 1000e6);
        uint256 balanceAfter = ousd.balanceOf(alice);

        assertApproxEqAbs(balanceAfter - balanceBefore, 1000e18, 1e18);
    }

    function test_mint_increasesTotalSupply() public {
        uint256 totalSupplyBefore = ousd.totalSupply();
        _mintOUSD(alice, 1000e6);
        uint256 totalSupplyAfter = ousd.totalSupply();

        // totalSupply increases by at least the minted amount (may be more due to rebase during mint)
        assertGe(totalSupplyAfter - totalSupplyBefore, 1000e18 - 1e18);
    }

    function test_mint_supplyInvariant() public {
        _mintOUSD(alice, 1000e6);
        _assertSupplyInvariant();
    }
}
