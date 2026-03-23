// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETH_Shared_Test} from "tests/smoke/mainnet/token/OETH/shared/Shared.t.sol";

contract Smoke_Concrete_OETH_Redeem_Test is Smoke_OETH_Shared_Test {
    function test_requestWithdrawal_and_claim() public {
        _mintOETH(alice, 1e18);
        uint256 oethBalance = oeth.balanceOf(alice);

        // Request withdrawal
        vm.prank(alice);
        (uint256 requestId,) = oethVault.requestWithdrawal(oethBalance);

        // OETH should be burned
        assertEq(oeth.balanceOf(alice), 0);

        // Ensure vault has enough WETH to cover the claim
        _ensureVaultLiquidity(1e18);

        // Warp past the claim delay
        vm.warp(block.timestamp + oethVault.withdrawalClaimDelay());

        // Claim
        uint256 wethBefore = weth.balanceOf(alice);
        vm.prank(alice);
        oethVault.claimWithdrawal(requestId);
        uint256 wethAfter = weth.balanceOf(alice);

        assertGt(wethAfter - wethBefore, 0);
    }

    function test_requestWithdrawal_decreasesTotalSupply() public {
        _mintOETH(alice, 1e18);
        uint256 totalSupplyBefore = oeth.totalSupply();
        uint256 oethBalance = oeth.balanceOf(alice);

        vm.prank(alice);
        oethVault.requestWithdrawal(oethBalance);

        assertApproxEqAbs(totalSupplyBefore - oeth.totalSupply(), oethBalance, 1);
    }

    function test_redeem_supplyInvariant() public {
        _mintOETH(alice, 1e18);
        uint256 oethBalance = oeth.balanceOf(alice);

        vm.prank(alice);
        oethVault.requestWithdrawal(oethBalance);

        _assertSupplyInvariant();
    }
}
