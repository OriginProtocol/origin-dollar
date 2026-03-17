// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OSonic_Shared_Test} from "tests/smoke/token/OSonic/shared/Shared.t.sol";

contract Smoke_Concrete_OSonic_Redeem_Test is Smoke_OSonic_Shared_Test {
    function test_requestWithdrawal_and_claim() public {
        _mintOSonic(alice, 1e18);
        uint256 oSonicBalance = oSonic.balanceOf(alice);

        // Request withdrawal
        vm.prank(alice);
        (uint256 requestId,) = oSonicVault.requestWithdrawal(oSonicBalance);

        // OSonic should be burned
        assertEq(oSonic.balanceOf(alice), 0);

        // Ensure vault has enough wS to cover the claim
        _ensureVaultLiquidity(1e18);

        // Warp past the claim delay
        vm.warp(block.timestamp + oSonicVault.withdrawalClaimDelay());

        // Claim
        uint256 wsBefore = wrappedSonic.balanceOf(alice);
        vm.prank(alice);
        oSonicVault.claimWithdrawal(requestId);
        uint256 wsAfter = wrappedSonic.balanceOf(alice);

        assertGt(wsAfter - wsBefore, 0);
    }

    function test_requestWithdrawal_decreasesTotalSupply() public {
        _mintOSonic(alice, 1e18);
        uint256 totalSupplyBefore = oSonic.totalSupply();
        uint256 oSonicBalance = oSonic.balanceOf(alice);

        vm.prank(alice);
        oSonicVault.requestWithdrawal(oSonicBalance);

        assertApproxEqAbs(totalSupplyBefore - oSonic.totalSupply(), oSonicBalance, 1);
    }

    function test_redeem_supplyInvariant() public {
        _mintOSonic(alice, 1e18);
        uint256 oSonicBalance = oSonic.balanceOf(alice);

        vm.prank(alice);
        oSonicVault.requestWithdrawal(oSonicBalance);

        _assertSupplyInvariant();
    }
}
