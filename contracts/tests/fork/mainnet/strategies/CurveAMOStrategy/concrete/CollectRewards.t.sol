// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_CurveAMOStrategy_Shared_Test} from "tests/fork/mainnet/strategies/CurveAMOStrategy/shared/Shared.t.sol";
import {ICurveMinter} from "contracts/interfaces/ICurveMinter.sol";

contract Fork_Concrete_CurveAMOStrategy_CollectRewards_Test is Fork_CurveAMOStrategy_Shared_Test {
    function setUp() public override {
        super.setUp();

        // Fresh gauge is not registered with Curve GaugeController, so minter.mint(gauge) will revert.
        // Mock minter.mint(address(gauge)) to be a no-op.
        vm.mockCall(
            address(curveMinter), abi.encodeWithSelector(ICurveMinter.mint.selector, address(curveGauge)), abi.encode()
        );
    }

    function test_collectRewardTokens() public {
        // Deal CRV to strategy to simulate earned rewards
        deal(address(crv), address(curveAMOStrategy), 10 ether);

        uint256 harvesterCrvBefore = crv.balanceOf(harvester);

        vm.prank(harvester);
        curveAMOStrategy.collectRewardTokens();

        // CRV should have been transferred to harvester
        assertEq(crv.balanceOf(harvester) - harvesterCrvBefore, 10 ether);
        assertEq(crv.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_collectRewardTokens_noOpWhenNoRewards() public {
        // No CRV in strategy, should not revert
        uint256 harvesterCrvBefore = crv.balanceOf(harvester);

        vm.prank(harvester);
        curveAMOStrategy.collectRewardTokens();

        assertEq(crv.balanceOf(harvester), harvesterCrvBefore);
    }
}
