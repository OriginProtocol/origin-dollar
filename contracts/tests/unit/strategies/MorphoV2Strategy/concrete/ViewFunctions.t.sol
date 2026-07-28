// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_MorphoV2Strategy_Shared_Test} from "tests/unit/strategies/MorphoV2Strategy/shared/Shared.t.sol";

contract Unit_Concrete_MorphoV2Strategy_ViewFunctions_Test is Unit_MorphoV2Strategy_Shared_Test {
    // --- checkBalance ---

    function test_checkBalance_returnsPreviewRedeem() public {
        _depositAsVault(100e18);

        uint256 balance = strategy.checkBalance(address(asset));
        assertEq(balance, 100e18);
    }

    function test_checkBalance_returnsZeroWithNoDeposit() public view {
        uint256 balance = strategy.checkBalance(address(asset));
        assertEq(balance, 0);
    }

    function test_checkBalance_RevertWhen_wrongAsset() public {
        vm.expectRevert("Unexpected asset address");
        strategy.checkBalance(address(0xdead));
    }

    // --- supportsAsset ---

    function test_supportsAsset_returnsTrueForAssetToken() public view {
        assertTrue(strategy.supportsAsset(address(asset)));
    }

    function test_supportsAsset_returnsFalseForOtherAssets() public view {
        assertFalse(strategy.supportsAsset(address(shareVault)));
        assertFalse(strategy.supportsAsset(address(0xdead)));
    }

    // --- safeApproveAllTokens ---

    function test_safeApproveAllTokens_approvesAssetToVault() public {
        vm.prank(governor);
        strategy.safeApproveAllTokens();

        assertEq(asset.allowance(address(strategy), address(shareVault)), type(uint256).max);
    }

    function test_safeApproveAllTokens_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        strategy.safeApproveAllTokens();
    }
}
