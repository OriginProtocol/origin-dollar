// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_WOETHBase_Shared_Test} from "tests/smoke/base/token/WOETHBase/shared/Shared.t.sol";

contract Smoke_Concrete_WOETHBase_ViewFunctions_Test is Smoke_WOETHBase_Shared_Test {
    function test_name() public view {
        assertEq(woethBase.name(), "Wrapped Super OETH");
    }

    function test_symbol() public view {
        assertEq(woethBase.symbol(), "wsuperOETHb");
    }

    function test_decimals() public view {
        assertEq(woethBase.decimals(), 18);
    }

    function test_asset_matchesOETHBase() public view {
        assertEq(woethBase.asset(), address(oethBase));
    }

    function test_totalAssets_isNonZero() public view {
        assertGt(woethBase.totalAssets(), 0);
    }

    function test_convertToShares_roundtrip() public view {
        uint256 assets = 1e18;
        uint256 assetsBack = woethBase.convertToAssets(woethBase.convertToShares(assets));
        assertApproxEqAbs(assetsBack, assets, 2);
    }
}
