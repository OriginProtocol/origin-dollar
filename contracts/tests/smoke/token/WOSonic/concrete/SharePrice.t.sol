// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_WOSonic_Shared_Test} from "tests/smoke/token/WOSonic/shared/Shared.t.sol";

contract Smoke_Concrete_WOSonic_SharePrice_Test is Smoke_WOSonic_Shared_Test {
    function test_sharePrice_increasesAfterRebase() public {
        uint256 priceBefore = woSonic.convertToAssets(1e18);

        _rebase(100e18);

        uint256 priceAfter = woSonic.convertToAssets(1e18);
        assertGt(priceAfter, priceBefore);
    }

    function test_totalAssets_correlatesWithTotalSupply() public view {
        uint256 totalAssets = woSonic.totalAssets();
        uint256 impliedAssets = woSonic.convertToAssets(woSonic.totalSupply());
        assertApproxEqAbs(totalAssets, impliedAssets, 1);
    }
}
