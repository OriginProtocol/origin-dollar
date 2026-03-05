// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_WrappedOusd_Shared_Test} from "tests/unit/token/WrappedOusd/shared/Shared.t.sol";

contract Unit_Concrete_WrappedOusd_ViewFunctions_Test is Unit_WrappedOusd_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ERC20 METADATA
    //////////////////////////////////////////////////////

    function test_name() public view {
        assertEq(wrappedOusd.name(), "Wrapped OUSD");
    }

    function test_symbol() public view {
        assertEq(wrappedOusd.symbol(), "WOUSD");
    }

    function test_decimals() public view {
        assertEq(wrappedOusd.decimals(), 18);
    }

    //////////////////////////////////////////////////////
    /// --- ERC4626 METADATA
    //////////////////////////////////////////////////////

    function test_asset() public view {
        assertEq(wrappedOusd.asset(), address(ousd));
    }

    function test_adjuster() public view {
        assertEq(wrappedOusd.adjuster(), 1e27);
    }

    //////////////////////////////////////////////////////
    /// --- TOTAL ASSETS
    //////////////////////////////////////////////////////

    function test_totalAssets_zeroWhenEmpty() public view {
        assertEq(wrappedOusd.totalAssets(), 0);
    }

    function test_totalAssets_immuneToDonation() public {
        _mintAndDeposit(alice, 10e6);
        uint256 totalAssetsBefore = wrappedOusd.totalAssets();

        _mintOUSD(bobby, 5e6);
        vm.prank(bobby);
        ousd.transfer(address(wrappedOusd), 5e18);

        assertEq(wrappedOusd.totalAssets(), totalAssetsBefore);
    }

    function test_totalAssets_increasesOnRebase() public {
        _mintAndDeposit(alice, 10e6);
        uint256 totalAssetsBefore = wrappedOusd.totalAssets();

        _rebase(10e6);

        assertGt(wrappedOusd.totalAssets(), totalAssetsBefore);
    }

    //////////////////////////////////////////////////////
    /// --- CONVERT FUNCTIONS
    //////////////////////////////////////////////////////

    function test_convertToShares_withAdjuster1e27() public view {
        assertEq(wrappedOusd.convertToShares(1e18), 1e18);
    }

    function test_convertToAssets_withAdjuster1e27() public view {
        assertEq(wrappedOusd.convertToAssets(1e18), 1e18);
    }
}
