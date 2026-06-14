// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_AerodromeAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";

// --- Project imports
import {INonfungiblePositionManager} from "contracts/interfaces/aerodrome/INonfungiblePositionManager.sol";

contract Smoke_Concrete_AerodromeAMOStrategy_ViewFunctions_Test is Smoke_AerodromeAMOStrategy_Shared_Test {
    // ─── Position & Balance ─────────────────────────────────────────

    function test_tokenId_isNonZero() public view {
        assertGt(aerodromeAMOStrategy.tokenId(), 0, "Strategy should have an active LP position");
    }

    function test_underlyingAssets_isNonZero() public view {
        assertGt(aerodromeAMOStrategy.underlyingAssets(), 0, "Underlying assets should be > 0");
    }

    function test_checkBalance_isNonZero() public view {
        assertGt(aerodromeAMOStrategy.checkBalance(address(weth)), 0, "checkBalance(WETH) should be > 0");
    }

    function test_getPositionPrincipal_isNonZero() public view {
        (uint256 wethAmount, uint256 oethbAmount) = aerodromeAMOStrategy.getPositionPrincipal();
        // When pool is out of the strategy's tick range, one side can be zero
        assertGt(wethAmount + oethbAmount, 0, "Position total value should be > 0");
    }

    // ─── Pool Price & Tick ──────────────────────────────────────────

    function test_getPoolX96Price_isNonZero() public view {
        uint160 price = aerodromeAMOStrategy.getPoolX96Price();
        assertGt(price, 0, "Pool price should be > 0");
    }

    function test_getCurrentTradingTick() public view {
        int24 tick = aerodromeAMOStrategy.getCurrentTradingTick();
        // The tick should be a reasonable value near parity (WETH/OETHb ≈ 1:1)
        assertGt(tick, -1000, "Tick should be > -1000");
        assertLt(tick, 1000, "Tick should be < 1000");
    }

    function test_getWETHShare_isValid() public view {
        uint256 share = aerodromeAMOStrategy.getWETHShare();
        // WETH share is a 1e18-denominated percentage, should be between 0 and 100%
        assertLe(share, 1 ether, "WETH share should be <= 100%");
    }

    // ─── supportsAsset ──────────────────────────────────────────────

    function test_supportsAsset_weth() public view {
        assertTrue(aerodromeAMOStrategy.supportsAsset(address(weth)), "Should support WETH");
    }

    function test_supportsAsset_nonWeth() public view {
        assertFalse(aerodromeAMOStrategy.supportsAsset(BaseAddresses.AERO), "Should not support AERO");
    }

    // ─── Immutables ─────────────────────────────────────────────────

    function test_immutables_WETH() public view {
        assertEq(aerodromeAMOStrategy.WETH(), BaseAddresses.WETH, "WETH mismatch");
    }

    function test_immutables_OETHb() public view {
        assertEq(aerodromeAMOStrategy.OETHb(), address(oethBase), "OETHb mismatch");
    }

    function test_immutables_clPool() public view {
        assertEq(address(aerodromeAMOStrategy.clPool()), BaseAddresses.aerodromeOETHbWETHClPool, "clPool mismatch");
    }

    function test_immutables_clGauge() public view {
        assertEq(address(aerodromeAMOStrategy.clGauge()), BaseAddresses.aerodromeOETHbWETHClGauge, "clGauge mismatch");
    }

    function test_immutables_swapRouter() public view {
        assertEq(address(aerodromeAMOStrategy.swapRouter()), BaseAddresses.swapRouter, "swapRouter mismatch");
    }

    function test_immutables_positionManager() public view {
        assertEq(
            address(aerodromeAMOStrategy.positionManager()),
            BaseAddresses.nonFungiblePositionManager,
            "positionManager mismatch"
        );
    }

    function test_immutables_helper() public view {
        assertEq(address(aerodromeAMOStrategy.helper()), BaseAddresses.sugarHelper, "helper mismatch");
    }

    function test_immutables_ticks() public view {
        assertEq(aerodromeAMOStrategy.lowerTick(), -1, "lowerTick should be -1");
        assertEq(aerodromeAMOStrategy.upperTick(), 0, "upperTick should be 0");
        assertEq(aerodromeAMOStrategy.tickSpacing(), 1, "tickSpacing should be 1");
    }

    // ─── Configuration ──────────────────────────────────────────────

    function test_allowedWethShareInterval_isSet() public view {
        uint256 start = aerodromeAMOStrategy.allowedWethShareStart();
        uint256 end = aerodromeAMOStrategy.allowedWethShareEnd();
        assertGt(start, 0, "allowedWethShareStart should be > 0");
        assertGt(end, 0, "allowedWethShareEnd should be > 0");
        assertLt(start, end, "start should be < end");
    }

    function test_vaultAddress_matchesExpected() public view {
        assertEq(aerodromeAMOStrategy.vaultAddress(), address(oethBaseVault), "Vault address mismatch");
    }

    function test_governor_isNonZero() public view {
        assertNotEq(aerodromeAMOStrategy.governor(), address(0), "Governor should not be zero");
    }

    function test_SOLVENCY_THRESHOLD() public view {
        assertEq(aerodromeAMOStrategy.SOLVENCY_THRESHOLD(), 0.998 ether, "SOLVENCY_THRESHOLD mismatch");
    }

    // ─── Gauge Staking ──────────────────────────────────────────────

    function test_lpToken_isStakedInGauge() public view {
        uint256 _tokenId = aerodromeAMOStrategy.tokenId();
        INonfungiblePositionManager pm = INonfungiblePositionManager(BaseAddresses.nonFungiblePositionManager);
        assertEq(pm.ownerOf(_tokenId), BaseAddresses.aerodromeOETHbWETHClGauge, "LP should be staked in gauge");
    }
}
