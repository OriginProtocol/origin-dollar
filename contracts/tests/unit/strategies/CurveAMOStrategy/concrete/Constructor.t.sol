// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CurveAMOStrategy_Shared_Test} from
    "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";
import {CurveAMOStrategy} from "contracts/strategies/CurveAMOStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {MockCurvePool} from "tests/mocks/MockCurvePool.sol";
import {MockCurveGauge} from "tests/mocks/MockCurveGauge.sol";
import {MockCurveMinter} from "tests/mocks/MockCurveMinter.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

contract Unit_Concrete_CurveAMOStrategy_Constructor_Test is Unit_CurveAMOStrategy_Shared_Test {
    function test_constructor_setsImmutables() public view {
        assertEq(address(curveAMOStrategy.hardAsset()), address(mockWeth));
        assertEq(address(curveAMOStrategy.oToken()), address(oeth));
        assertEq(address(curveAMOStrategy.lpToken()), address(curvePool));
        assertEq(address(curveAMOStrategy.curvePool()), address(curvePool));
        assertEq(address(curveAMOStrategy.gauge()), address(curveGauge));
        assertEq(address(curveAMOStrategy.minter()), address(curveMinter));
        // coin[0] = weth, coin[1] = oeth
        assertEq(curveAMOStrategy.hardAssetCoinIndex(), 0);
        assertEq(curveAMOStrategy.otokenCoinIndex(), 1);
        assertEq(curveAMOStrategy.decimalsHardAsset(), 18);
        assertEq(curveAMOStrategy.decimalsOToken(), 18);
    }

    function test_constructor_RevertWhen_invalidCoinIndexes() public {
        // Pool with swapped coin order that doesn't match constructor args
        MockCurvePool badPool = new MockCurvePool(address(oeth), address(mockWeth));
        MockCurveGauge badGauge = new MockCurveGauge(address(badPool));

        // Create a mock token that is neither weth nor oeth for coin mismatch
        MockERC20 randomToken = new MockERC20("Random", "RND", 18);
        MockCurvePool mismatchPool = new MockCurvePool(address(randomToken), address(oeth));
        MockCurveGauge mismatchGauge = new MockCurveGauge(address(mismatchPool));

        vm.expectRevert("Invalid coin indexes");
        new CurveAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(mismatchPool),
                vaultAddress: address(oethVault)
            }),
            address(oeth),
            address(mockWeth),
            address(mismatchGauge),
            address(curveMinter)
        );
    }

    function test_constructor_RevertWhen_invalidGaugeLpToken() public {
        // Gauge with wrong LP token
        MockCurveGauge badGauge = new MockCurveGauge(address(1));

        vm.expectRevert("Invalid pool");
        new CurveAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(curvePool),
                vaultAddress: address(oethVault)
            }),
            address(oeth),
            address(mockWeth),
            address(badGauge),
            address(curveMinter)
        );
    }
}
