// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_MorphoV2Strategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_MorphoV2Strategy_ViewFunctions_Test is Smoke_MorphoV2Strategy_Shared_Test {
    // --- checkBalance ---

    function test_checkBalance_isNonZero() public view {
        assertGt(morphoV2Strategy.checkBalance(address(usdc)), 0, "checkBalance(USDC) should be > 0");
    }

    // --- supportsAsset ---

    function test_supportsAsset_usdc() public view {
        assertTrue(morphoV2Strategy.supportsAsset(address(usdc)), "Should support USDC");
    }

    function test_supportsAsset_nonUsdc() public view {
        assertFalse(morphoV2Strategy.supportsAsset(Mainnet.WETH), "Should not support WETH");
    }

    // --- Immutables ---

    function test_platformAddress() public view {
        assertEq(morphoV2Strategy.platformAddress(), Mainnet.MorphoOUSDv2Vault, "platformAddress mismatch");
    }

    function test_assetToken() public view {
        assertEq(address(morphoV2Strategy.assetToken()), Mainnet.USDC, "assetToken mismatch");
    }

    function test_shareToken() public view {
        assertEq(address(morphoV2Strategy.shareToken()), Mainnet.MorphoOUSDv2Vault, "shareToken mismatch");
    }

    // --- Configuration ---

    function test_vaultAddress() public view {
        assertEq(morphoV2Strategy.vaultAddress(), address(ousdVault), "Vault address mismatch");
    }

    // --- maxWithdraw ---

    function test_maxWithdraw_isNonZero() public view {
        assertGt(morphoV2Strategy.maxWithdraw(), 0, "maxWithdraw should be > 0");
    }
}
