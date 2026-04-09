// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_ViewFunctions_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    function test_supportsAsset_trueForWS() public view {
        assertTrue(sonicSwapXAMOStrategy.supportsAsset(address(mockWrappedSonic)));
    }

    function test_supportsAsset_falseForOther() public view {
        assertFalse(sonicSwapXAMOStrategy.supportsAsset(address(oSonic)));
        assertFalse(sonicSwapXAMOStrategy.supportsAsset(alice));
    }

    function test_solvencyThreshold_constant() public view {
        assertEq(sonicSwapXAMOStrategy.SOLVENCY_THRESHOLD(), 0.998 ether);
    }

    function test_precision_constant() public view {
        assertEq(sonicSwapXAMOStrategy.PRECISION(), 1e18);
    }
}
