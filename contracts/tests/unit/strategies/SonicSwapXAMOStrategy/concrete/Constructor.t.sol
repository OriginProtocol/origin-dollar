// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicSwapXAMOStrategy_Shared_Test} from
    "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";
import {SonicSwapXAMOStrategy} from "contracts/strategies/sonic/SonicSwapXAMOStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {MockSwapXPair} from "tests/mocks/MockSwapXPair.sol";
import {MockSwapXGauge} from "tests/mocks/MockSwapXGauge.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_Constructor_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    function test_constructor_setsImmutables() public view {
        assertEq(sonicSwapXAMOStrategy.ws(), address(mockWrappedSonic));
        assertEq(sonicSwapXAMOStrategy.os(), address(oSonic));
        assertEq(sonicSwapXAMOStrategy.pool(), address(mockSwapXPair));
        assertEq(sonicSwapXAMOStrategy.gauge(), address(mockSwapXGauge));
    }

    function test_constructor_RevertWhen_incorrectPoolTokens() public {
        // Pool with reversed token order (token0=OS, token1=wS)
        MockSwapXPair wrongPool = new MockSwapXPair(address(oSonic), address(mockWrappedSonic));
        MockSwapXGauge gauge_ = new MockSwapXGauge(address(wrongPool), address(swpxToken));

        vm.expectRevert("Incorrect pool tokens");
        new SonicSwapXAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(wrongPool),
                vaultAddress: address(oSonicVault)
            }),
            address(oSonic),
            address(mockWrappedSonic),
            address(gauge_)
        );
    }

    function test_constructor_RevertWhen_incorrectTokenDecimals() public {
        // wS token with 8 decimals instead of 18
        MockERC20 badWs = new MockERC20("Bad wS", "bwS", 8);
        MockSwapXPair pool_ = new MockSwapXPair(address(badWs), address(oSonic));
        MockSwapXGauge gauge_ = new MockSwapXGauge(address(pool_), address(swpxToken));

        vm.expectRevert("Incorrect token decimals");
        new SonicSwapXAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(pool_),
                vaultAddress: address(oSonicVault)
            }),
            address(oSonic),
            address(badWs),
            address(gauge_)
        );
    }

    function test_constructor_RevertWhen_poolNotStable() public {
        MockSwapXPair unstablePool = new MockSwapXPair(address(mockWrappedSonic), address(oSonic));
        unstablePool.setStable(false);
        MockSwapXGauge gauge_ = new MockSwapXGauge(address(unstablePool), address(swpxToken));

        vm.expectRevert("Pool not stable");
        new SonicSwapXAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(unstablePool),
                vaultAddress: address(oSonicVault)
            }),
            address(oSonic),
            address(mockWrappedSonic),
            address(gauge_)
        );
    }

    function test_constructor_RevertWhen_incorrectGauge() public {
        MockSwapXPair pool_ = new MockSwapXPair(address(mockWrappedSonic), address(oSonic));
        // Gauge pointing to wrong LP token
        MockSwapXGauge wrongGauge = new MockSwapXGauge(address(alice), address(swpxToken));

        vm.expectRevert("Incorrect gauge");
        new SonicSwapXAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(pool_),
                vaultAddress: address(oSonicVault)
            }),
            address(oSonic),
            address(mockWrappedSonic),
            address(wrongGauge)
        );
    }
}
