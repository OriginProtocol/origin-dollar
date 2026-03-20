// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BaseCurveAMOStrategy_Shared_Test} from
    "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_BaseCurveAMOStrategy_CheckBalance_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    /// @notice checkBalance matches expected: directBalance + (gaugeBalance * virtualPrice / 1e18)
    function testFuzz_checkBalance_calculation(uint256 directBalance, uint256 gaugeBalance, uint256 virtualPrice)
        public
    {
        virtualPrice = bound(virtualPrice, 0.5e18, 2e18);
        directBalance = bound(directBalance, 0, 1_000_000 ether);
        gaugeBalance = bound(gaugeBalance, 0, 1_000_000 ether);

        curvePool.setVirtualPrice(virtualPrice);

        deal(address(weth), address(baseCurveAMOStrategy), directBalance);

        if (gaugeBalance > 0) {
            curvePool.mint(address(this), gaugeBalance);
            curvePool.transfer(address(baseCurveAMOStrategy), gaugeBalance);
            vm.startPrank(address(baseCurveAMOStrategy));
            curvePool.approve(address(curveGauge), gaugeBalance);
            curveGauge.deposit(gaugeBalance);
            vm.stopPrank();
        }

        uint256 expected = directBalance + ((gaugeBalance * virtualPrice) / 1e18);
        uint256 actual = baseCurveAMOStrategy.checkBalance(address(weth));

        assertEq(actual, expected);
    }
}
