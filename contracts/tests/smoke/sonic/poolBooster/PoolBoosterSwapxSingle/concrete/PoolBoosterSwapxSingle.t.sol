// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Smoke_PoolBoosterSwapxSingle_Shared_Test
} from "tests/smoke/sonic/poolBooster/PoolBoosterSwapxSingle/shared/Shared.t.sol";

// --- Test utilities
import {Sonic} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Smoke_Concrete_PoolBoosterSwapxSingle_Test is Smoke_PoolBoosterSwapxSingle_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_bribeContract() public view {
        assertNotEq(address(boosterSwapxSingle.bribeContract()), address(0));
    }

    function test_osToken() public view {
        assertEq(address(boosterSwapxSingle.osToken()), Sonic.OSonicProxy);
    }

    function test_minBribeAmount() public view {
        assertEq(boosterSwapxSingle.MIN_BRIBE_AMOUNT(), 1e10);
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////

    function test_bribe() public {
        _mintAndFundBooster(address(boosterSwapxSingle), 1 ether);
        assertGt(IERC20(Sonic.OSonicProxy).balanceOf(address(boosterSwapxSingle)), 0);

        boosterSwapxSingle.bribe();

        assertEq(IERC20(Sonic.OSonicProxy).balanceOf(address(boosterSwapxSingle)), 0);
    }
}
