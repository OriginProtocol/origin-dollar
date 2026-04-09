// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_WOSonic_Shared_Test} from "tests/smoke/sonic/token/WOSonic/shared/Shared.t.sol";

contract Smoke_Concrete_WOSonic_ViewFunctions_Test is Smoke_WOSonic_Shared_Test {
    function test_name() public view {
        assertEq(woSonic.name(), "Wrapped OS");
    }

    function test_symbol() public view {
        assertEq(woSonic.symbol(), "wOS");
    }

    function test_decimals() public view {
        assertEq(woSonic.decimals(), 18);
    }

    function test_asset_matchesOSonic() public view {
        assertEq(woSonic.asset(), address(oSonic));
    }

    function test_totalAssets_isNonZero() public view {
        assertGt(woSonic.totalAssets(), 0);
    }

    function test_convertToShares_roundtrip() public view {
        uint256 assets = 1e18;
        uint256 assetsBack = woSonic.convertToAssets(woSonic.convertToShares(assets));
        assertApproxEqAbs(assetsBack, assets, 2);
    }
}
