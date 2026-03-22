// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_OETHSupernovaAMOStrategy_ViewFunctions_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    function test_supportsAsset_trueForWETH() public view {
        assertTrue(oethSupernovaAMOStrategy.supportsAsset(address(mockWeth)));
    }

    function test_supportsAsset_falseForOther() public view {
        assertFalse(oethSupernovaAMOStrategy.supportsAsset(address(oeth)));
        assertFalse(oethSupernovaAMOStrategy.supportsAsset(alice));
    }

    function test_solvencyThreshold_constant() public view {
        assertEq(oethSupernovaAMOStrategy.SOLVENCY_THRESHOLD(), 0.998 ether);
    }

    function test_precision_constant() public view {
        assertEq(oethSupernovaAMOStrategy.PRECISION(), 1e18);
    }
}
