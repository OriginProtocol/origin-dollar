// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_WOETH_Shared_Test} from "tests/smoke/mainnet/token/WOETH/shared/Shared.t.sol";

contract Smoke_Concrete_WOETH_SharePrice_Test is Smoke_WOETH_Shared_Test {
    function test_sharePrice_increasesAfterRebase() public {
        uint256 priceBefore = woeth.convertToAssets(1e18);

        _rebase(100e18);

        uint256 priceAfter = woeth.convertToAssets(1e18);
        assertGt(priceAfter, priceBefore);
    }

    function test_totalAssets_correlatesWithTotalSupply() public view {
        uint256 totalAssets = woeth.totalAssets();
        uint256 impliedAssets = woeth.convertToAssets(woeth.totalSupply());
        assertApproxEqAbs(totalAssets, impliedAssets, 1);
    }
}
