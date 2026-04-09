// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_AerodromeAMOStrategy_Shared_Test} from "tests/unit/strategies/AerodromeAMOStrategy/shared/Shared.t.sol";

// --- Test utilities
import {Strategies} from "tests/utils/Artifacts.sol";

import {MockCLPool} from "tests/mocks/aerodrome/MockCLPool.sol";

contract Unit_Concrete_AerodromeAMOStrategy_Initialize_Test is Unit_AerodromeAMOStrategy_Shared_Test {
    function test_initialize_setsRewardToken() public view {
        assertEq(aerodromeAMOStrategy.rewardTokenAddresses(0), address(aeroToken));
    }

    function test_initialize_setsImmutables() public view {
        assertEq(aerodromeAMOStrategy.WETH(), address(mockWeth));
        assertEq(aerodromeAMOStrategy.OETHb(), address(oethBase));
        assertEq(address(aerodromeAMOStrategy.swapRouter()), address(mockSwapRouter));
        assertEq(address(aerodromeAMOStrategy.positionManager()), address(mockPositionManager));
        assertEq(address(aerodromeAMOStrategy.clPool()), address(mockCLPool));
        assertEq(address(aerodromeAMOStrategy.clGauge()), address(mockCLGauge));
        assertEq(address(aerodromeAMOStrategy.helper()), address(mockSugarHelper));
    }

    function test_initialize_setsTicks() public view {
        assertEq(aerodromeAMOStrategy.lowerTick(), -1);
        assertEq(aerodromeAMOStrategy.upperTick(), 0);
        assertEq(aerodromeAMOStrategy.tickSpacing(), 1);
    }

    function test_initialize_setsSqrtRatios() public view {
        assertEq(aerodromeAMOStrategy.sqrtRatioX96TickLower(), SQRT_RATIO_TICK_MINUS_1);
        assertEq(aerodromeAMOStrategy.sqrtRatioX96TickHigher(), SQRT_RATIO_TICK_0);
        assertEq(aerodromeAMOStrategy.sqrtRatioX96TickClosestToParity(), SQRT_RATIO_TICK_0);
    }

    function test_initialize_setsVaultAndPlatform() public view {
        assertEq(aerodromeAMOStrategy.vaultAddress(), address(oethBaseVault));
        assertEq(aerodromeAMOStrategy.platformAddress(), address(mockCLPool));
    }

    function test_initialize_setsSolvencyThreshold() public view {
        assertEq(aerodromeAMOStrategy.SOLVENCY_THRESHOLD(), 0.998 ether);
    }

    function test_initialize_tokenIdIsZero() public view {
        assertEq(aerodromeAMOStrategy.tokenId(), 0);
    }

    function test_initialize_underlyingAssetsIsZero() public view {
        assertEq(aerodromeAMOStrategy.underlyingAssets(), 0);
    }

    //////////////////////////////////////////////////////
    /// --- Constructor reverts
    //////////////////////////////////////////////////////

    function test_initialize_RevertWhen_misconfiguredTickClosestToParity() public {
        vm.expectRevert("Misconfigured tickClosestToParity");
        vm.deployCode(
            Strategies.AERODROME_AMO_STRATEGY,
            abi.encode(
                address(mockCLPool),
                address(oethBaseVault),
                address(mockWeth),
                address(oethBase),
                address(mockSwapRouter),
                address(mockPositionManager),
                address(mockCLPool),
                address(mockCLGauge),
                address(mockSugarHelper),
                int24(-1),
                int24(0),
                int24(-2) // neither lowerTick (-1) nor upperTick (0)
            )
        );
    }

    function test_initialize_RevertWhen_token0NotWeth() public {
        // Pool with wrong token0 (not WETH)
        MockCLPool wrongPool = new MockCLPool(alice, address(oethBase));
        wrongPool.setSlot0(DEFAULT_POOL_PRICE, -1);

        vm.expectRevert("Only WETH supported as token0");
        vm.deployCode(
            Strategies.AERODROME_AMO_STRATEGY,
            abi.encode(
                address(wrongPool),
                address(oethBaseVault),
                address(mockWeth),
                address(oethBase),
                address(mockSwapRouter),
                address(mockPositionManager),
                address(wrongPool),
                address(mockCLGauge),
                address(mockSugarHelper),
                int24(-1),
                int24(0),
                int24(0)
            )
        );
    }

    function test_initialize_RevertWhen_token1NotOethb() public {
        // Pool with wrong token1 (not OETHb)
        MockCLPool wrongPool = new MockCLPool(address(mockWeth), alice);
        wrongPool.setSlot0(DEFAULT_POOL_PRICE, -1);

        vm.expectRevert("Only OETHb supported as token1");
        vm.deployCode(
            Strategies.AERODROME_AMO_STRATEGY,
            abi.encode(
                address(wrongPool),
                address(oethBaseVault),
                address(mockWeth),
                address(oethBase),
                address(mockSwapRouter),
                address(mockPositionManager),
                address(wrongPool),
                address(mockCLGauge),
                address(mockSugarHelper),
                int24(-1),
                int24(0),
                int24(0)
            )
        );
    }

    function test_initialize_RevertWhen_unsupportedTickSpacing() public {
        // Pool with tickSpacing != 1
        MockCLPool wrongPool = new MockCLPool(address(mockWeth), address(oethBase));
        wrongPool.setSlot0(DEFAULT_POOL_PRICE, -1);
        wrongPool.setTickSpacing(2);

        vm.expectRevert("Unsupported tickSpacing");
        vm.deployCode(
            Strategies.AERODROME_AMO_STRATEGY,
            abi.encode(
                address(wrongPool),
                address(oethBaseVault),
                address(mockWeth),
                address(oethBase),
                address(mockSwapRouter),
                address(mockPositionManager),
                address(wrongPool),
                address(mockCLGauge),
                address(mockSugarHelper),
                int24(-1),
                int24(0),
                int24(0)
            )
        );
    }
}
