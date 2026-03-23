// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OSonic_Shared_Test} from "tests/smoke/sonic/token/OSonic/shared/Shared.t.sol";

contract Smoke_Concrete_OSonic_Mint_Test is Smoke_OSonic_Shared_Test {
    function test_mint_producesOSonic() public {
        uint256 balanceBefore = oSonic.balanceOf(alice);
        _mintOSonic(alice, 1e18);
        uint256 balanceAfter = oSonic.balanceOf(alice);

        assertApproxEqAbs(balanceAfter - balanceBefore, 1e18, 1e16);
    }

    function test_mint_increasesTotalSupply() public {
        uint256 totalSupplyBefore = oSonic.totalSupply();
        _mintOSonic(alice, 1e18);
        uint256 totalSupplyAfter = oSonic.totalSupply();

        // totalSupply increases by at least the minted amount (may be more due to rebase during mint)
        assertGe(totalSupplyAfter - totalSupplyBefore, 1e18 - 1e16);
    }

    function test_mint_supplyInvariant() public {
        _mintOSonic(alice, 1e18);
        _assertSupplyInvariant();
    }
}
