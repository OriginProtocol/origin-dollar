// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_WOETHPlume_Shared_Test} from "tests/unit/token/WOETHPlume/shared/Shared.sol";

contract Unit_Concrete_WOETHPlume_ViewFunctions_Test is Unit_WOETHPlume_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ERC20 METADATA
    //////////////////////////////////////////////////////

    function test_name() public view {
        assertEq(woethPlume.name(), "Wrapped Super OETH");
    }

    function test_symbol() public view {
        assertEq(woethPlume.symbol(), "wsuperOETHp");
    }

    function test_decimals() public view {
        assertEq(woethPlume.decimals(), 18);
    }

    //////////////////////////////////////////////////////
    /// --- ERC4626 METADATA
    //////////////////////////////////////////////////////

    function test_asset() public view {
        assertEq(woethPlume.asset(), address(oeth));
    }

    function test_adjuster() public view {
        assertEq(woethPlume.adjuster(), 1e27);
    }

    //////////////////////////////////////////////////////
    /// --- TOTAL ASSETS
    //////////////////////////////////////////////////////

    function test_totalAssets_zeroWhenEmpty() public view {
        assertEq(woethPlume.totalAssets(), 0);
    }

    function test_totalAssets_immuneToDonation() public {
        _mintAndDeposit(alice, 10e18);
        uint256 totalAssetsBefore = woethPlume.totalAssets();

        _mintOETH(bobby, 5e18);
        vm.prank(bobby);
        oeth.transfer(address(woethPlume), 5e18);

        assertEq(woethPlume.totalAssets(), totalAssetsBefore);
    }

    function test_totalAssets_increasesOnRebase() public {
        _mintAndDeposit(alice, 10e18);
        uint256 totalAssetsBefore = woethPlume.totalAssets();

        _rebase(10e18);

        assertGt(woethPlume.totalAssets(), totalAssetsBefore);
    }

    //////////////////////////////////////////////////////
    /// --- CONVERT FUNCTIONS
    //////////////////////////////////////////////////////

    function test_convertToShares_withAdjuster1e27() public view {
        assertEq(woethPlume.convertToShares(1e18), 1e18);
    }

    function test_convertToAssets_withAdjuster1e27() public view {
        assertEq(woethPlume.convertToAssets(1e18), 1e18);
    }
}
