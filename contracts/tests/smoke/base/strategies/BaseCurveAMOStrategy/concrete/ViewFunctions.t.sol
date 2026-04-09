// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_BaseCurveAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Smoke_Concrete_BaseCurveAMOStrategy_ViewFunctions_Test is Smoke_BaseCurveAMOStrategy_Shared_Test {
    // --- checkBalance ---

    function test_checkBalance_isNonZero() public view {
        assertGt(baseCurveAMOStrategy.checkBalance(address(weth)), 0, "checkBalance(WETH) should be > 0");
    }

    // --- supportsAsset ---

    function test_supportsAsset_weth() public view {
        assertTrue(baseCurveAMOStrategy.supportsAsset(address(weth)), "Should support WETH");
    }

    function test_supportsAsset_nonWeth() public view {
        assertFalse(baseCurveAMOStrategy.supportsAsset(BaseAddresses.USDC), "Should not support USDC");
    }

    // --- Constants ---

    function test_SOLVENCY_THRESHOLD() public view {
        assertEq(baseCurveAMOStrategy.SOLVENCY_THRESHOLD(), 0.998 ether, "SOLVENCY_THRESHOLD mismatch");
    }

    function test_maxSlippage_isSet() public view {
        assertGt(baseCurveAMOStrategy.maxSlippage(), 0, "maxSlippage should be > 0");
    }

    // --- Immutables ---

    function test_immutables_weth() public view {
        assertEq(address(baseCurveAMOStrategy.weth()), BaseAddresses.WETH, "weth mismatch");
    }

    function test_immutables_oeth() public view {
        assertEq(address(baseCurveAMOStrategy.oeth()), address(oethBase), "oeth mismatch");
    }

    function test_immutables_curvePool() public view {
        assertEq(address(baseCurveAMOStrategy.curvePool()), BaseAddresses.OETHb_WETH_pool, "curvePool mismatch");
    }

    function test_immutables_gauge() public view {
        assertEq(address(baseCurveAMOStrategy.gauge()), BaseAddresses.OETHb_WETH_gauge, "gauge mismatch");
    }

    function test_immutables_gaugeFactory() public view {
        assertEq(
            address(baseCurveAMOStrategy.gaugeFactory()),
            BaseAddresses.childLiquidityGaugeFactory,
            "gaugeFactory mismatch"
        );
    }

    // --- Configuration ---

    function test_vaultAddress_matchesExpected() public view {
        assertEq(baseCurveAMOStrategy.vaultAddress(), address(oethBaseVault), "Vault address mismatch");
    }

    function test_governor_isNonZero() public view {
        assertNotEq(baseCurveAMOStrategy.governor(), address(0), "Governor should not be zero");
    }

    // --- Gauge Staking ---

    function test_lpToken_isStakedInGauge() public view {
        uint256 gaugeBalance = IERC20(baseCurveAMOStrategy.gauge()).balanceOf(address(baseCurveAMOStrategy));
        assertGt(gaugeBalance, 0, "LP should be staked in gauge");
    }
}
