// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/fork/mainnet/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Fork_Concrete_OETHSupernovaAMOStrategy_CollectRewards_Test is Fork_OETHSupernovaAMOStrategy_Shared_Test {
    function setUp() public override {
        super.setUp();
        // Deposit to strategy so there's gauge balance for rewards
        _depositAsVault(5000 ether);
    }

    function test_collectRewardTokens() public {
        // Get the distribution address from the gauge
        (, bytes memory distributorData) = address(supernovaGauge).staticcall(abi.encodeWithSignature("DISTRIBUTION()"));
        address distributor = abi.decode(distributorData, (address));

        // Fund distributor with supernova reward token and notify rewards
        uint256 rewardAmount = 1000 ether;
        deal(Mainnet.supernovaToken, distributor, rewardAmount);
        vm.startPrank(distributor);
        IERC20(Mainnet.supernovaToken).approve(address(supernovaGauge), rewardAmount);
        (bool success,) = address(supernovaGauge)
            .call(abi.encodeWithSignature("notifyRewardAmount(address,uint256)", Mainnet.supernovaToken, rewardAmount));
        require(success, "notifyRewardAmount failed");
        vm.stopPrank();

        // Warp time to accumulate rewards
        vm.warp(block.timestamp + 7 days);

        // Collect rewards
        uint256 harvesterRewardsBefore = IERC20(Mainnet.supernovaToken).balanceOf(harvester);

        vm.prank(harvester);
        oethSupernovaAMOStrategy.collectRewardTokens();

        assertGt(IERC20(Mainnet.supernovaToken).balanceOf(harvester), harvesterRewardsBefore);
    }

    function test_collectRewardTokens_noRewards() public {
        uint256 harvesterRewardsBefore = IERC20(Mainnet.supernovaToken).balanceOf(harvester);

        vm.prank(harvester);
        oethSupernovaAMOStrategy.collectRewardTokens();

        // No rewards should be collected (or only dust from existing gauge state)
        assertApproxEqAbs(IERC20(Mainnet.supernovaToken).balanceOf(harvester), harvesterRewardsBefore, 1 ether);
    }
}
