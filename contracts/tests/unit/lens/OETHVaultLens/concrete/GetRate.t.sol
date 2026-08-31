// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OETHVaultLens_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_Concrete_OETHVaultLens_GetRate_Test is Unit_OETHVaultLens_Shared_Test {
    function test_getRate_isOneAtRebase() public view {
        assertEq(lens.getRate(), 1e18);
    }

    function test_getRate_increasesWithUnrebasedYield() public {
        mockVault.setTotalValue(105e18);
        assertEq(lens.getRate(), 1.05e18);
    }

    function test_getRate_returnsFractionalRate() public {
        mockVault.setTotalValue(101e18);
        assertEq(lens.getRate(), 1.01e18);
    }

    function test_getRate_atExactMaxVerifiedBalanceAge() public {
        vm.warp(uint256(mockStrategy.lastVerifiedBalanceTimestamp()) + lens.MAX_VERIFIED_BALANCE_AGE());
        assertEq(lens.getRate(), 1e18);
    }

    function test_getRate_RevertWhen_oneSecondPastMaxVerifiedBalanceAge() public {
        vm.warp(uint256(mockStrategy.lastVerifiedBalanceTimestamp()) + lens.MAX_VERIFIED_BALANCE_AGE() + 1);
        vm.expectRevert("Stale verified balance");
        lens.getRate();
    }

    function test_getRate_RevertWhen_balancesNeverVerified() public {
        mockStrategy.setLastVerifiedBalanceTimestamp(0);
        vm.expectRevert("Stale verified balance");
        lens.getRate();
    }

    function test_getRate_RevertWhen_supplyIsZero() public {
        mockOToken.setTotalSupply(0);
        vm.expectRevert("No oToken supply");
        lens.getRate();
    }

    function test_getRate_RevertWhen_rateIsZero() public {
        mockVault.setTotalValue(0);
        vm.expectRevert("Invalid rate");
        lens.getRate();
    }
}
