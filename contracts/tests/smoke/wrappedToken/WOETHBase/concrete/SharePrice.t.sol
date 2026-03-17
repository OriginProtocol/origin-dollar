// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_WOETHBase_Shared_Test} from "tests/smoke/wrappedToken/WOETHBase/shared/Shared.t.sol";

contract Smoke_Concrete_WOETHBase_SharePrice_Test is Smoke_WOETHBase_Shared_Test {
    function test_sharePrice_increasesAfterRebase() public {
        uint256 priceBefore = woethBase.convertToAssets(1e18);

        _rebase(100e18);

        uint256 priceAfter = woethBase.convertToAssets(1e18);
        assertGt(priceAfter, priceBefore);
    }

    function test_totalAssets_correlatesWithTotalSupply() public view {
        uint256 totalAssets = woethBase.totalAssets();
        uint256 impliedAssets = woethBase.convertToAssets(woethBase.totalSupply());
        assertApproxEqAbs(totalAssets, impliedAssets, 1);
    }
}
