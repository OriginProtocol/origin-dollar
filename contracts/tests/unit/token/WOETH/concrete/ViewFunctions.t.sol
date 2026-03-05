// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_WOETH_Shared_Test} from "tests/unit/token/WOETH/shared/Shared.t.sol";

contract Unit_Concrete_WOETH_ViewFunctions_Test is Unit_WOETH_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ERC20 METADATA
    //////////////////////////////////////////////////////

    function test_name() public view {
        assertEq(woeth.name(), "Wrapped OETH");
    }

    function test_symbol() public view {
        assertEq(woeth.symbol(), "wOETH");
    }

    function test_decimals() public view {
        assertEq(woeth.decimals(), 18);
    }

    //////////////////////////////////////////////////////
    /// --- ERC4626 METADATA
    //////////////////////////////////////////////////////

    function test_asset() public view {
        assertEq(woeth.asset(), address(oeth));
    }

    function test_adjuster() public view {
        assertEq(woeth.adjuster(), 1e27);
    }

    //////////////////////////////////////////////////////
    /// --- TOTAL ASSETS
    //////////////////////////////////////////////////////

    function test_totalAssets_zeroWhenEmpty() public view {
        assertEq(woeth.totalAssets(), 0);
    }

    function test_totalAssets_afterDeposit() public {
        _mintAndDeposit(alice, 10e18);
        // totalAssets should reflect deposited amount (within rounding)
        assertApproxEqAbs(woeth.totalAssets(), 10e18, 1);
    }

    function test_totalAssets_immuneToDonation() public {
        _mintAndDeposit(matt, 10e18);
        uint256 totalAssetsBefore = woeth.totalAssets();

        // Donate OETH directly to WOETH contract
        _mintOETH(alice, 5e18);
        vm.prank(alice);
        oeth.transfer(address(woeth), 5e18);

        // totalAssets should NOT change from the donation
        assertEq(woeth.totalAssets(), totalAssetsBefore);
    }

    function test_totalAssets_increasesOnRebase() public {
        _mintAndDeposit(matt, 10e18);
        uint256 totalAssetsBefore = woeth.totalAssets();

        _rebase(10e18);

        // totalAssets increases because rebasingCreditsPerTokenHighres changes
        assertGt(woeth.totalAssets(), totalAssetsBefore);
    }

    //////////////////////////////////////////////////////
    /// --- CONVERT FUNCTIONS
    //////////////////////////////////////////////////////

    function test_convertToShares_zeroAssets() public view {
        assertEq(woeth.convertToShares(0), 0);
    }

    function test_convertToShares_withAdjuster1e27() public view {
        // With adjuster=1e27 and no rebase, 1:1 ratio
        assertEq(woeth.convertToShares(1e18), 1e18);
    }

    function test_convertToAssets_zeroShares() public view {
        assertEq(woeth.convertToAssets(0), 0);
    }

    function test_convertToAssets_withAdjuster1e27() public view {
        // With adjuster=1e27 and no rebase, 1:1 ratio
        assertEq(woeth.convertToAssets(1e18), 1e18);
    }

    function test_convertToShares_afterRebase() public {
        _mintAndDeposit(matt, 10e18);
        _rebase(10e18);

        // After rebase, 1 OETH should be worth less than 1 share
        uint256 shares = woeth.convertToShares(1e18);
        assertLt(shares, 1e18);
    }

    function test_convertToAssets_afterRebase() public {
        _mintAndDeposit(matt, 10e18);
        _rebase(10e18);

        // After rebase, 1 share should be worth more than 1 OETH
        uint256 assets = woeth.convertToAssets(1e18);
        assertGt(assets, 1e18);
    }

    //////////////////////////////////////////////////////
    /// --- PREVIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_previewDeposit() public view {
        uint256 shares = woeth.previewDeposit(1e18);
        assertEq(shares, woeth.convertToShares(1e18));
    }

    function test_previewMint() public view {
        uint256 assets = woeth.previewMint(1e18);
        // previewMint rounds up
        assertApproxEqAbs(assets, woeth.convertToAssets(1e18), 1);
    }

    function test_previewWithdraw() public view {
        uint256 shares = woeth.previewWithdraw(1e18);
        // previewWithdraw rounds up
        assertApproxEqAbs(shares, woeth.convertToShares(1e18), 1);
    }

    function test_previewRedeem() public view {
        uint256 assets = woeth.previewRedeem(1e18);
        assertEq(assets, woeth.convertToAssets(1e18));
    }

    //////////////////////////////////////////////////////
    /// --- MAX FUNCTIONS
    //////////////////////////////////////////////////////

    function test_maxDeposit() public view {
        assertEq(woeth.maxDeposit(matt), type(uint256).max);
    }

    function test_maxMint() public view {
        assertEq(woeth.maxMint(matt), type(uint256).max);
    }

    function test_maxWithdraw_noShares() public view {
        assertEq(woeth.maxWithdraw(alice), 0);
    }

    function test_maxWithdraw_withShares() public {
        _mintAndDeposit(alice, 10e18);
        assertApproxEqAbs(woeth.maxWithdraw(alice), 10e18, 1);
    }

    function test_maxRedeem_noShares() public view {
        assertEq(woeth.maxRedeem(alice), 0);
    }

    function test_maxRedeem_withShares() public {
        uint256 shares = _mintAndDeposit(matt, 10e18);
        assertEq(woeth.maxRedeem(matt), shares);
    }
}
