// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OUSD_Shared_Test} from "tests/smoke/token/OUSD/shared/Shared.t.sol";

contract Smoke_Concrete_OUSD_Redeem_Test is Smoke_OUSD_Shared_Test {
    function test_requestWithdrawal_and_claim() public {
        _mintOUSD(alice, 1000e6);
        uint256 ousdBalance = ousd.balanceOf(alice);

        // Request withdrawal
        vm.prank(alice);
        (uint256 requestId,) = ousdVault.requestWithdrawal(ousdBalance);

        // OUSD should be burned
        assertEq(ousd.balanceOf(alice), 0);

        // Ensure vault has enough USDC to cover the claim
        _ensureVaultLiquidity(1000e6);

        // Warp past the claim delay
        vm.warp(block.timestamp + ousdVault.withdrawalClaimDelay());

        // Claim
        uint256 usdcBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        ousdVault.claimWithdrawal(requestId);
        uint256 usdcAfter = usdc.balanceOf(alice);

        assertGt(usdcAfter - usdcBefore, 0);
    }

    function test_requestWithdrawal_decreasesTotalSupply() public {
        _mintOUSD(alice, 1000e6);
        uint256 totalSupplyBefore = ousd.totalSupply();
        uint256 ousdBalance = ousd.balanceOf(alice);

        vm.prank(alice);
        ousdVault.requestWithdrawal(ousdBalance);

        assertApproxEqAbs(totalSupplyBefore - ousd.totalSupply(), ousdBalance, 1);
    }

    function test_redeem_supplyInvariant() public {
        _mintOUSD(alice, 1000e6);
        uint256 ousdBalance = ousd.balanceOf(alice);

        vm.prank(alice);
        ousdVault.requestWithdrawal(ousdBalance);

        _assertSupplyInvariant();
    }
}
