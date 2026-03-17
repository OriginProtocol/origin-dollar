// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_WOETH_Shared_Test} from "tests/smoke/wrappedToken/WOETH/shared/Shared.t.sol";

contract Smoke_Concrete_WOETH_ViewFunctions_Test is Smoke_WOETH_Shared_Test {
    function test_name() public view {
        assertEq(woeth.name(), "Wrapped OETH");
    }

    function test_symbol() public view {
        assertEq(woeth.symbol(), "wOETH");
    }

    function test_decimals() public view {
        assertEq(woeth.decimals(), 18);
    }

    function test_asset_matchesOETH() public view {
        assertEq(woeth.asset(), address(oeth));
    }

    function test_totalAssets_isNonZero() public view {
        assertGt(woeth.totalAssets(), 0);
    }

    function test_convertToShares_roundtrip() public view {
        uint256 assets = 1e18;
        uint256 assetsBack = woeth.convertToAssets(woeth.convertToShares(assets));
        assertApproxEqAbs(assetsBack, assets, 1);
    }
}
