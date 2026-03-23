// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_WrappedOusd_Shared_Test} from "tests/smoke/mainnet/token/WrappedOusd/shared/Shared.t.sol";

contract Smoke_Concrete_WrappedOusd_ViewFunctions_Test is Smoke_WrappedOusd_Shared_Test {
    function test_name() public view {
        assertEq(wrappedOusd.name(), "Wrapped OUSD");
    }

    function test_symbol() public view {
        assertEq(wrappedOusd.symbol(), "WOUSD");
    }

    function test_decimals() public view {
        assertEq(wrappedOusd.decimals(), 18);
    }

    function test_asset_matchesOUSD() public view {
        assertEq(wrappedOusd.asset(), address(ousd));
    }

    function test_totalAssets_isNonZero() public view {
        assertGt(wrappedOusd.totalAssets(), 0);
    }

    function test_convertToShares_roundtrip() public view {
        uint256 assets = 1e18;
        uint256 assetsBack = wrappedOusd.convertToAssets(wrappedOusd.convertToShares(assets));
        assertApproxEqAbs(assetsBack, assets, 1);
    }
}
