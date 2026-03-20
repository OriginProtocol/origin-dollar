// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_SonicSwapXAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {Sonic} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_SonicSwapXAMOStrategy_ViewFunctions_Test is Smoke_SonicSwapXAMOStrategy_Shared_Test {
    // --- checkBalance ---

    function test_checkBalance_isNonZero() public view {
        assertGt(sonicSwapXAMOStrategy.checkBalance(address(wrappedSonic)), 0, "checkBalance(wS) should be > 0");
    }

    // --- supportsAsset ---

    function test_supportsAsset_ws() public view {
        assertTrue(sonicSwapXAMOStrategy.supportsAsset(address(wrappedSonic)), "Should support wS");
    }

    function test_supportsAsset_nonWS() public view {
        assertFalse(sonicSwapXAMOStrategy.supportsAsset(Sonic.SWPx), "Should not support SWPx");
    }

    // --- Immutables ---

    function test_immutables_asset() public view {
        // V1 uses ws(), V2 uses asset()
        (bool success, bytes memory data) =
            address(sonicSwapXAMOStrategy).staticcall(abi.encodeWithSignature("asset()"));
        if (!success) {
            (success, data) = address(sonicSwapXAMOStrategy).staticcall(abi.encodeWithSignature("ws()"));
        }
        assertTrue(success, "asset/ws mismatch");
        assertEq(abi.decode(data, (address)), Sonic.wS, "asset mismatch");
    }

    function test_immutables_oToken() public view {
        // V1 uses os(), V2 uses oToken()
        (bool success, bytes memory data) =
            address(sonicSwapXAMOStrategy).staticcall(abi.encodeWithSignature("oToken()"));
        if (!success) {
            (success, data) = address(sonicSwapXAMOStrategy).staticcall(abi.encodeWithSignature("os()"));
        }
        assertTrue(success, "oToken/os mismatch");
        assertEq(abi.decode(data, (address)), Sonic.OSonicProxy, "oToken mismatch");
    }

    function test_immutables_pool() public view {
        assertEq(sonicSwapXAMOStrategy.pool(), Sonic.SwapXWSOS_pool, "pool mismatch");
    }

    function test_immutables_gauge() public view {
        assertEq(sonicSwapXAMOStrategy.gauge(), Sonic.SwapXWSOS_gauge, "gauge mismatch");
    }

    // --- Configuration ---

    function test_vaultAddress_matchesExpected() public view {
        assertEq(sonicSwapXAMOStrategy.vaultAddress(), address(oSonicVault), "Vault address mismatch");
    }

    function test_governor_isNonZero() public view {
        assertNotEq(sonicSwapXAMOStrategy.governor(), address(0), "Governor should not be zero");
    }

    function test_SOLVENCY_THRESHOLD() public view {
        assertEq(sonicSwapXAMOStrategy.SOLVENCY_THRESHOLD(), 0.998 ether, "SOLVENCY_THRESHOLD mismatch");
    }

    function test_maxDepeg_isSet() public view {
        assertGt(sonicSwapXAMOStrategy.maxDepeg(), 0, "maxDepeg should be > 0");
    }
}
