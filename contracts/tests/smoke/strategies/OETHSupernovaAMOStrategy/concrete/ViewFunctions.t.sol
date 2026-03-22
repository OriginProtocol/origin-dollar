// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHSupernovaAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_OETHSupernovaAMOStrategy_ViewFunctions_Test is Smoke_OETHSupernovaAMOStrategy_Shared_Test {
    // --- checkBalance ---

    function test_checkBalance_isNonZero() public view {
        assertGt(oethSupernovaAMOStrategy.checkBalance(address(wrappedEther)), 0, "checkBalance(WETH) should be > 0");
    }

    // --- supportsAsset ---

    function test_supportsAsset_weth() public view {
        assertTrue(oethSupernovaAMOStrategy.supportsAsset(address(wrappedEther)), "Should support WETH");
    }

    function test_supportsAsset_nonWETH() public view {
        assertFalse(oethSupernovaAMOStrategy.supportsAsset(Mainnet.supernovaToken), "Should not support NOVA");
    }

    // --- Immutables ---

    function test_immutables_asset() public view {
        assertEq(oethSupernovaAMOStrategy.asset(), Mainnet.WETH, "asset mismatch");
    }

    function test_immutables_oToken() public view {
        assertEq(oethSupernovaAMOStrategy.oToken(), Mainnet.OETHProxy, "oToken mismatch");
    }

    function test_immutables_pool() public view {
        assertEq(oethSupernovaAMOStrategy.pool(), Mainnet.SupernovaOETHWETH_pool, "pool mismatch");
    }

    function test_immutables_gauge() public view {
        assertEq(oethSupernovaAMOStrategy.gauge(), Mainnet.SupernovaOETHWETH_gauge, "gauge mismatch");
    }

    // --- Configuration ---

    function test_vaultAddress_matchesExpected() public view {
        assertEq(oethSupernovaAMOStrategy.vaultAddress(), address(oethVault), "Vault address mismatch");
    }

    function test_governor_isNonZero() public view {
        assertNotEq(oethSupernovaAMOStrategy.governor(), address(0), "Governor should not be zero");
    }

    function test_SOLVENCY_THRESHOLD() public view {
        assertEq(oethSupernovaAMOStrategy.SOLVENCY_THRESHOLD(), 0.998 ether, "SOLVENCY_THRESHOLD mismatch");
    }

    function test_maxDepeg_isSet() public view {
        assertGt(oethSupernovaAMOStrategy.maxDepeg(), 0, "maxDepeg should be > 0");
    }
}
