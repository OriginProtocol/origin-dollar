// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SwapXSingle_Shared_Test} from "tests/unit/poolBooster/SwapXSingle/shared/Shared.t.sol";

// --- Test utilities
import {PoolBoosters} from "tests/utils/Artifacts.sol";

contract Unit_Concrete_PoolBoosterSwapxSingle_Constructor_Test is Unit_SwapXSingle_Shared_Test {
    function test_constructor() public view {
        assertEq(address(boosterSwapxSingle.bribeContract()), mockBribeContract);
        assertEq(address(boosterSwapxSingle.osToken()), address(oSonic));
        assertEq(boosterSwapxSingle.MIN_BRIBE_AMOUNT(), 1e10);
    }

    function test_constructor_RevertWhen_zeroBribeContract() public {
        vm.expectRevert("Invalid bribeContract address");
        vm.deployCode(PoolBoosters.POOL_BOOSTER_SWAPX_SINGLE, abi.encode(address(0), address(oSonic)));
    }
}
