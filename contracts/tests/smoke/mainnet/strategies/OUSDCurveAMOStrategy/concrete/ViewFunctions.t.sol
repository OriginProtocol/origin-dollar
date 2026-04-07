// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OUSDCurveAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_OUSDCurveAMOStrategy_ViewFunctions_Test is Smoke_OUSDCurveAMOStrategy_Shared_Test {
    // --- checkBalance ---

    function test_checkBalance_isNonZero() public view {
        assertGt(curveAMOStrategy.checkBalance(address(usdc)), 0, "checkBalance(USDC) should be > 0");
    }

    // --- supportsAsset ---

    function test_supportsAsset_usdc() public view {
        assertTrue(curveAMOStrategy.supportsAsset(address(usdc)), "Should support USDC");
    }

    function test_supportsAsset_nonUsdc() public view {
        assertFalse(curveAMOStrategy.supportsAsset(Mainnet.WETH), "Should not support WETH");
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
        assertEq(address(curveAMOStrategy.hardAsset()), Mainnet.USDC, "hardAsset mismatch");
    }

    function test_immutables_oToken() public view {
        assertEq(address(curveAMOStrategy.oToken()), address(ousd), "oToken mismatch");
    }

    function test_immutables_curvePool() public view {
        assertEq(address(curvePool), Mainnet.curve_OUSD_USDC_pool, "curvePool mismatch");
    }

    function test_immutables_gauge() public view {
        assertNotEq(address(gauge), address(0), "gauge should not be zero");
    }

    function test_immutables_minter() public view {
        assertEq(address(curveAMOStrategy.minter()), Mainnet.CRVMinter, "minter mismatch");
    }

    function test_immutables_decimals() public view {
        assertEq(curveAMOStrategy.decimalsHardAsset(), 6, "decimalsHardAsset should be 6");
        assertEq(curveAMOStrategy.decimalsOToken(), 18, "decimalsOToken should be 18");
    }

    // --- Configuration ---

    function test_vaultAddress_matchesExpected() public view {
        assertEq(curveAMOStrategy.vaultAddress(), address(ousdVault), "Vault address mismatch");
    }

    function test_governor_isNonZero() public view {
        assertNotEq(curveAMOStrategy.governor(), address(0), "Governor should not be zero");
    }

    // --- Gauge Staking ---

    function test_lpToken_isStakedInGauge() public view {
        uint256 gaugeBalance = gauge.balanceOf(address(curveAMOStrategy));
        assertGt(gaugeBalance, 0, "LP should be staked in gauge");
    }
}
