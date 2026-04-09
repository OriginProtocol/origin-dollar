// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Smoke_PoolBoosterSwapxDouble_Shared_Test
} from "tests/smoke/sonic/poolBooster/PoolBoosterSwapxDouble/shared/Shared.t.sol";

// --- Test utilities
import {Sonic} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Smoke_Concrete_PoolBoosterSwapxDouble_Test is Smoke_PoolBoosterSwapxDouble_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_bribeContractOS() public view {
        assertNotEq(address(boosterSwapxDouble.bribeContractOS()), address(0));
    }

    function test_bribeContractOther() public view {
        assertNotEq(address(boosterSwapxDouble.bribeContractOther()), address(0));
    }

    function test_osToken() public view {
        assertEq(address(boosterSwapxDouble.osToken()), Sonic.OSonicProxy);
    }

    function test_split() public view {
        uint256 split = boosterSwapxDouble.split();
        assertGt(split, 1e16);
        assertLt(split, 99e16);
    }

    function test_minBribeAmount() public view {
        assertEq(boosterSwapxDouble.MIN_BRIBE_AMOUNT(), 1e10);
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////

    function test_bribe() public {
        _mintAndFundBooster(address(boosterSwapxDouble), 1 ether);
        assertGt(IERC20(Sonic.OSonicProxy).balanceOf(address(boosterSwapxDouble)), 0);

        boosterSwapxDouble.bribe();

        assertEq(IERC20(Sonic.OSonicProxy).balanceOf(address(boosterSwapxDouble)), 0);
    }
}
