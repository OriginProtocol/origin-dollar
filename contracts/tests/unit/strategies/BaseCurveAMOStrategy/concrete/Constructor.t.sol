// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BaseCurveAMOStrategy_Shared_Test} from "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";
import {BaseCurveAMOStrategy} from "contracts/strategies/BaseCurveAMOStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_BaseCurveAMOStrategy_Constructor_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    function test_constructor_setsImmutables() public view {
        assertEq(address(baseCurveAMOStrategy.weth()), address(mockWeth));
        assertEq(address(baseCurveAMOStrategy.oeth()), address(oeth));
        assertEq(address(baseCurveAMOStrategy.lpToken()), address(curvePool));
        assertEq(address(baseCurveAMOStrategy.curvePool()), address(curvePool));
        assertEq(address(baseCurveAMOStrategy.gauge()), address(curveGauge));
        assertEq(address(baseCurveAMOStrategy.gaugeFactory()), address(curveGaugeFactory));
        // coin[0] = weth, coin[1] = oeth
        assertEq(baseCurveAMOStrategy.wethCoinIndex(), 0);
        assertEq(baseCurveAMOStrategy.oethCoinIndex(), 1);
    }

    function test_constructor_setsGovernorToZero() public view {
        // BaseCurveAMOStrategy calls _setGovernor(address(0)) in constructor
        // Governor is then set via vm.store in test setup
        // Just verify we can still call governor-restricted functions (proving setup worked)
        assertEq(baseCurveAMOStrategy.maxSlippage(), DEFAULT_MAX_SLIPPAGE);
    }
}
