// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_SonicSwapXAMOStrategy_Shared_Test
} from "tests/fork/sonic/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";

// --- Test utilities
import {Sonic} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Fork_Concrete_SonicSwapXAMOStrategy_CollectRewards_Test is Fork_SonicSwapXAMOStrategy_Shared_Test {
    function setUp() public override {
        super.setUp();
        // Deposit to strategy so there's gauge balance for rewards
        _depositAsVault(5000 ether);
    }

    function test_collectRewardTokens() public {
        // Get the distribution address from the gauge
        (, bytes memory distributorData) = address(swapXGauge).staticcall(abi.encodeWithSignature("DISTRIBUTION()"));
        address distributor = abi.decode(distributorData, (address));

        // Fund distributor with SWPx and notify rewards
        uint256 rewardAmount = 1000 ether;
        deal(Sonic.SWPx, distributor, rewardAmount);
        vm.startPrank(distributor);
        IERC20(Sonic.SWPx).approve(address(swapXGauge), rewardAmount);
        (bool success,) = address(swapXGauge)
            .call(abi.encodeWithSignature("notifyRewardAmount(address,uint256)", Sonic.SWPx, rewardAmount));
        require(success, "notifyRewardAmount failed");
        vm.stopPrank();

        // Warp time to accumulate rewards
        vm.warp(block.timestamp + 7 days);

        // Collect rewards
        uint256 harvesterSWPxBefore = IERC20(Sonic.SWPx).balanceOf(harvester);

        vm.prank(harvester);
        sonicSwapXAMOStrategy.collectRewardTokens();

        assertGt(IERC20(Sonic.SWPx).balanceOf(harvester), harvesterSWPxBefore);
    }

    function test_collectRewardTokens_noRewards() public {
        uint256 harvesterSWPxBefore = IERC20(Sonic.SWPx).balanceOf(harvester);

        vm.prank(harvester);
        sonicSwapXAMOStrategy.collectRewardTokens();

        // No rewards should be collected (or only dust from existing gauge state)
        assertApproxEqAbs(IERC20(Sonic.SWPx).balanceOf(harvester), harvesterSWPxBefore, 1 ether);
    }
}
