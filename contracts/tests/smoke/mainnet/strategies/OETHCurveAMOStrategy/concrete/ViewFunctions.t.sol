// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETHCurveAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_OETHCurveAMOStrategy_ViewFunctions_Test is Smoke_OETHCurveAMOStrategy_Shared_Test {
    // --- checkBalance ---

    function test_checkBalance_isNonZero() public view {
        assertGt(curveAMOStrategy.checkBalance(address(weth)), 0, "checkBalance(WETH) should be > 0");
    }

    // --- supportsAsset ---

    function test_supportsAsset_weth() public view {
        assertTrue(curveAMOStrategy.supportsAsset(address(weth)), "Should support WETH");
    }

    function test_supportsAsset_nonWeth() public view {
        assertFalse(curveAMOStrategy.supportsAsset(Mainnet.USDC), "Should not support USDC");
    }

    // --- Constants ---

    function test_SOLVENCY_THRESHOLD() public view {
        assertEq(curveAMOStrategy.SOLVENCY_THRESHOLD(), 0.998 ether, "SOLVENCY_THRESHOLD mismatch");
    }

    function test_maxSlippage_isSet() public view {
        assertGt(curveAMOStrategy.maxSlippage(), 0, "maxSlippage should be > 0");
    }

    // --- Immutables ---

    function test_immutables_hardAsset() public view {
        assertEq(address(curveAMOStrategy.hardAsset()), Mainnet.WETH, "hardAsset mismatch");
    }

    function test_immutables_oToken() public view {
        assertEq(address(curveAMOStrategy.oToken()), address(oeth), "oToken mismatch");
    }

    function test_immutables_curvePool() public view {
        assertEq(address(curvePool), Mainnet.curve_OETH_WETH_pool, "curvePool mismatch");
    }

    function test_immutables_gauge() public view {
        assertNotEq(address(gauge), address(0), "gauge should not be zero");
    }

    function test_immutables_minter() public view {
        assertEq(address(curveAMOStrategy.minter()), Mainnet.CRVMinter, "minter mismatch");
    }

    function test_immutables_decimals() public view {
        assertEq(curveAMOStrategy.decimalsHardAsset(), 18, "decimalsHardAsset should be 18");
        assertEq(curveAMOStrategy.decimalsOToken(), 18, "decimalsOToken should be 18");
    }

    // --- Configuration ---

    function test_vaultAddress_matchesExpected() public view {
        assertEq(curveAMOStrategy.vaultAddress(), address(oethVault), "Vault address mismatch");
    }

    function test_governor_isNonZero() public view {
        assertNotEq(curveAMOStrategy.governor(), address(0), "Governor should not be zero");
    }

    /// @dev curve-amo-oeth.mainnet.fork-test.js "Should have correct parameters after deployment":
    ///      independent governor assertion (not the circular fixture read).
    function test_governor_isTimelock() public view {
        assertEq(curveAMOStrategy.governor(), Mainnet.Timelock, "Governor should be the Timelock");
    }

    function test_rewardToken_isCRV() public view {
        assertEq(curveAMOStrategy.rewardTokenAddresses(0), Mainnet.CRV, "Reward token 0 should be CRV");
    }

    // --- Gauge Staking ---

    function test_lpToken_isStakedInGauge() public view {
        uint256 gaugeBalance = gauge.balanceOf(address(curveAMOStrategy));
        assertGt(gaugeBalance, 0, "LP should be staked in gauge");
    }
}
