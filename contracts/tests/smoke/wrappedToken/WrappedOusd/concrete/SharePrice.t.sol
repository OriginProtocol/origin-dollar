// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_WrappedOusd_Shared_Test} from "tests/smoke/wrappedToken/WrappedOusd/shared/Shared.t.sol";

contract Smoke_Concrete_WrappedOusd_SharePrice_Test is Smoke_WrappedOusd_Shared_Test {
    function test_sharePrice_increasesAfterRebase() public {
        uint256 priceBefore = wrappedOusd.convertToAssets(1e18);

        _rebase(1000e6);

        uint256 priceAfter = wrappedOusd.convertToAssets(1e18);
        assertGt(priceAfter, priceBefore);
    }

    function test_totalAssets_correlatesWithTotalSupply() public view {
        uint256 totalAssets = wrappedOusd.totalAssets();
        uint256 impliedAssets = wrappedOusd.convertToAssets(wrappedOusd.totalSupply());
        assertApproxEqAbs(totalAssets, impliedAssets, 1);
    }
}
