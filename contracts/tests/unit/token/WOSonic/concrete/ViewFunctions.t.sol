// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Unit_WOSonic_Shared_Test} from "tests/unit/token/WOSonic/shared/Shared.sol";

contract Unit_Concrete_WOSonic_ViewFunctions_Test is Unit_WOSonic_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ERC20 METADATA
    //////////////////////////////////////////////////////

    function test_name() public view {
        assertEq(woSonic.name(), "Wrapped OS");
    }

    function test_symbol() public view {
        assertEq(woSonic.symbol(), "wOS");
    }

    function test_decimals() public view {
        assertEq(woSonic.decimals(), 18);
    }

    //////////////////////////////////////////////////////
    /// --- ERC4626 METADATA
    //////////////////////////////////////////////////////

    function test_asset() public view {
        assertEq(woSonic.asset(), address(oSonic));
    }

    function test_adjuster() public view {
        assertEq(woSonic.adjuster(), 1e27);
    }

    //////////////////////////////////////////////////////
    /// --- TOTAL ASSETS
    //////////////////////////////////////////////////////

    function test_totalAssets_zeroWhenEmpty() public view {
        assertEq(woSonic.totalAssets(), 0);
    }

    function test_totalAssets_immuneToDonation() public {
        _mintAndDeposit(alice, 10e18);
        uint256 totalAssetsBefore = woSonic.totalAssets();

        _mintOSonic(bobby, 5e18);
        vm.prank(bobby);
        IERC20(address(oSonic)).transfer(address(woSonic), 5e18);

        assertEq(woSonic.totalAssets(), totalAssetsBefore);
    }

    function test_totalAssets_increasesOnRebase() public {
        _mintAndDeposit(alice, 10e18);
        uint256 totalAssetsBefore = woSonic.totalAssets();

        _rebase(10e18);

        assertGt(woSonic.totalAssets(), totalAssetsBefore);
    }

    //////////////////////////////////////////////////////
    /// --- CONVERT FUNCTIONS
    //////////////////////////////////////////////////////

    function test_convertToShares_withAdjuster1e27() public view {
        assertEq(woSonic.convertToShares(1e18), 1e18);
    }

    function test_convertToAssets_withAdjuster1e27() public view {
        assertEq(woSonic.convertToAssets(1e18), 1e18);
    }
}
