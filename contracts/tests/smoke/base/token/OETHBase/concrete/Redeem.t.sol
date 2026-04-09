// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETHBase_Shared_Test} from "tests/smoke/base/token/OETHBase/shared/Shared.t.sol";

contract Smoke_Concrete_OETHBase_Redeem_Test is Smoke_OETHBase_Shared_Test {
    function test_requestWithdrawal_and_claim() public {
        _mintOETHBase(alice, 1e18);
        uint256 oethBaseBalance = oethBase.balanceOf(alice);

        // Request withdrawal
        vm.prank(alice);
        (uint256 requestId,) = oethBaseVault.requestWithdrawal(oethBaseBalance);

        // OETHBase should be burned
        assertEq(oethBase.balanceOf(alice), 0);

        // Ensure vault has enough WETH to cover the claim
        _ensureVaultLiquidity(1e18);

        // Warp past the claim delay
        vm.warp(block.timestamp + oethBaseVault.withdrawalClaimDelay());

        // Claim
        uint256 wethBefore = weth.balanceOf(alice);
        vm.prank(alice);
        oethBaseVault.claimWithdrawal(requestId);
        uint256 wethAfter = weth.balanceOf(alice);

        assertGt(wethAfter - wethBefore, 0);
    }

    function test_requestWithdrawal_decreasesTotalSupply() public {
        _mintOETHBase(alice, 1e18);
        uint256 totalSupplyBefore = oethBase.totalSupply();
        uint256 oethBaseBalance = oethBase.balanceOf(alice);

        vm.prank(alice);
        oethBaseVault.requestWithdrawal(oethBaseBalance);

        assertApproxEqAbs(totalSupplyBefore - oethBase.totalSupply(), oethBaseBalance, 1);
    }

    function test_redeem_supplyInvariant() public {
        _mintOETHBase(alice, 1e18);
        uint256 oethBaseBalance = oethBase.balanceOf(alice);

        vm.prank(alice);
        oethBaseVault.requestWithdrawal(oethBaseBalance);

        _assertSupplyInvariant();
    }
}
