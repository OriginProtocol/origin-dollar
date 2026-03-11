// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CurveAMOStrategy_Shared_Test} from
    "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_CurveAMOStrategy_CheckBalance_Test is Unit_CurveAMOStrategy_Shared_Test {
    /// @notice checkBalance matches expected: directBalance + (gaugeBalance * virtualPrice / 1e18)
    function testFuzz_checkBalance_calculation(uint256 directBalance, uint256 gaugeBalance, uint256 virtualPrice)
        public
    {
        virtualPrice = bound(virtualPrice, 0.5e18, 2e18);
        directBalance = bound(directBalance, 0, 1_000_000 ether);
        gaugeBalance = bound(gaugeBalance, 0, 1_000_000 ether);

        // Set virtual price
        curvePool.setVirtualPrice(virtualPrice);

        // Deal WETH directly to strategy
        deal(address(weth), address(curveAMOStrategy), directBalance);

        // Mint LP tokens and deposit to gauge as strategy
        if (gaugeBalance > 0) {
            curvePool.mint(address(this), gaugeBalance);
            curvePool.transfer(address(curveAMOStrategy), gaugeBalance);
            vm.startPrank(address(curveAMOStrategy));
            curvePool.approve(address(curveGauge), gaugeBalance);
            curveGauge.deposit(gaugeBalance);
            vm.stopPrank();
        }

        uint256 expected = directBalance + ((gaugeBalance * virtualPrice) / 1e18);
        uint256 actual = curveAMOStrategy.checkBalance(address(weth));

        assertEq(actual, expected);
    }
}
