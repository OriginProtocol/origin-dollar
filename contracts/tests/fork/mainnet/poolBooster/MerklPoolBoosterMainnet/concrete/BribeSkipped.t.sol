// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_MerklPoolBoosterMainnet_Shared_Test
} from "tests/fork/mainnet/poolBooster/MerklPoolBoosterMainnet/shared/Shared.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {IPoolBoosterMerkl} from "contracts/interfaces/poolBooster/IPoolBoosterMerkl.sol";

contract Fork_Concrete_MerklPoolBoosterMainnet_BribeSkipped_Test is Fork_MerklPoolBoosterMainnet_Shared_Test {
    function test_bribe_skippedBelowMinBribeAmount() public {
        IPoolBoosterMerkl booster = _createMerklBooster(1);

        // Fund with 100 wei (below MIN_BRIBE_AMOUNT of 1e10)
        _dealOETH(address(booster), 100);

        vm.prank(Mainnet.Timelock);
        booster.bribe();

        // Balance should be unchanged
        assertEq(IERC20(address(oeth)).balanceOf(address(booster)), 100);
    }

    function test_bribe_skippedBelowMerklMinAmount() public {
        IPoolBoosterMerkl booster = _createMerklBooster(1);

        // Fund with 100 wei — below MIN_BRIBE_AMOUNT
        _dealOETH(address(booster), 100);

        vm.prank(Mainnet.Timelock);
        booster.bribe();
        assertEq(IERC20(address(oeth)).balanceOf(address(booster)), 100);

        // Add more but still below the Merkl min threshold
        // (balance * 1 hours must be >= minAmount * duration)
        // minAmount = 1e18, duration = 86400 → need >= 86400e18 / 3600 = 24e18
        _dealOETH(address(booster), 1e12);

        vm.prank(Mainnet.Timelock);
        booster.bribe();

        // Balance should still be unchanged (100 + 1e12)
        assertEq(IERC20(address(oeth)).balanceOf(address(booster)), 1e12 + 100);
    }
}
