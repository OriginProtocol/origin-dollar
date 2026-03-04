// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Unit_WOETHBase_Shared_Test} from "tests/unit/token/WOETHBase/shared/Shared.sol";

contract Unit_Concrete_WOETHBase_ViewFunctions_Test is Unit_WOETHBase_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ERC20 METADATA
    //////////////////////////////////////////////////////

    function test_name() public view {
        assertEq(woethBase.name(), "Wrapped Super OETH");
    }

    function test_symbol() public view {
        assertEq(woethBase.symbol(), "wsuperOETHb");
    }

    function test_decimals() public view {
        assertEq(woethBase.decimals(), 18);
    }

    //////////////////////////////////////////////////////
    /// --- ERC4626 METADATA
    //////////////////////////////////////////////////////

    function test_asset() public view {
        assertEq(woethBase.asset(), address(oethBase));
    }

    function test_adjuster() public view {
        assertEq(woethBase.adjuster(), 1e27);
    }

    //////////////////////////////////////////////////////
    /// --- TOTAL ASSETS
    //////////////////////////////////////////////////////

    function test_totalAssets_zeroWhenEmpty() public view {
        assertEq(woethBase.totalAssets(), 0);
    }

    function test_totalAssets_immuneToDonation() public {
        _mintAndDeposit(alice, 10e18);
        uint256 totalAssetsBefore = woethBase.totalAssets();

        _mintOETHBase(bobby, 5e18);
        vm.prank(bobby);
        IERC20(address(oethBase)).transfer(address(woethBase), 5e18);

        assertEq(woethBase.totalAssets(), totalAssetsBefore);
    }

    function test_totalAssets_increasesOnRebase() public {
        _mintAndDeposit(alice, 10e18);
        uint256 totalAssetsBefore = woethBase.totalAssets();

        _rebase(10e18);

        assertGt(woethBase.totalAssets(), totalAssetsBefore);
    }

    //////////////////////////////////////////////////////
    /// --- CONVERT FUNCTIONS
    //////////////////////////////////////////////////////

    function test_convertToShares_withAdjuster1e27() public view {
        assertEq(woethBase.convertToShares(1e18), 1e18);
    }

    function test_convertToAssets_withAdjuster1e27() public view {
        assertEq(woethBase.convertToAssets(1e18), 1e18);
    }
}
