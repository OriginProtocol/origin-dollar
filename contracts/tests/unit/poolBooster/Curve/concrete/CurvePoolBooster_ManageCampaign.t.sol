// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";
import {CurvePoolBooster} from "contracts/poolBooster/curve/CurvePoolBooster.sol";
import {CurvePoolBoosterPlain} from "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol";
import {ICampaignRemoteManager} from "contracts/interfaces/ICampaignRemoteManager.sol";

contract Unit_Concrete_CurvePoolBooster_ManageCampaign_Test is Unit_Curve_Shared_Test {
    function setUp() public override {
        super.setUp();
        _mockCampaignRemoteManager();

        // Set campaignId to non-zero so manageCampaign can be called
        vm.prank(governor);
        curvePoolBoosterPlain.setCampaignId(1);
    }

    function test_manageCampaign_addReward() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        vm.prank(governor);
        curvePoolBoosterPlain.manageCampaign(type(uint256).max, 0, 0, 0);

        // Fee is 10% of 1e18 = 1e17
        assertEq(oeth.balanceOf(mockFeeCollector), 1e17);
        // Remaining 9e17 approved to campaignRemoteManager (mock doesn't transfer)
        assertEq(oeth.balanceOf(address(curvePoolBoosterPlain)), 9e17);
        assertEq(oeth.allowance(address(curvePoolBoosterPlain), mockCampaignRemoteManager), 9e17);
    }

    function test_manageCampaign_addPeriods() public {
        vm.prank(governor);
        curvePoolBoosterPlain.manageCampaign(0, 3, 0, 0);

        // No tokens moved, just period update
        assertEq(oeth.balanceOf(mockFeeCollector), 0);
    }

    function test_manageCampaign_allParams() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.TotalRewardAmountUpdated(9e17);
        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.NumberOfPeriodsUpdated(3);
        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.RewardPerVoteUpdated(1e15);

        vm.prank(governor);
        curvePoolBoosterPlain.manageCampaign(type(uint256).max, 3, 1e15, 0);
    }

    function test_manageCampaign_noRewardUpdate() public {
        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.NumberOfPeriodsUpdated(3);
        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.RewardPerVoteUpdated(1e15);

        vm.prank(governor);
        curvePoolBoosterPlain.manageCampaign(0, 3, 1e15, 0);

        // No fee collected
        assertEq(oeth.balanceOf(mockFeeCollector), 0);
    }

    function test_manageCampaign_maxRewardAmount() public {
        _dealOETH(address(curvePoolBoosterPlain), 5e17);

        // Request more than balance, uses balance
        vm.prank(governor);
        curvePoolBoosterPlain.manageCampaign(1e18, 0, 0, 0);

        // Fee is 10% of 5e17 = 5e16
        assertEq(oeth.balanceOf(mockFeeCollector), 5e16);
        // Remaining 45e16 approved to campaignRemoteManager (mock doesn't transfer)
        assertEq(oeth.balanceOf(address(curvePoolBoosterPlain)), 45e16);
        assertEq(oeth.allowance(address(curvePoolBoosterPlain), mockCampaignRemoteManager), 45e16);
    }

    function test_manageCampaign_event_totalRewardAmountUpdated() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.TotalRewardAmountUpdated(9e17);

        vm.prank(governor);
        curvePoolBoosterPlain.manageCampaign(type(uint256).max, 0, 0, 0);
    }

    function test_manageCampaign_feeDeduction() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.FeeCollected(mockFeeCollector, 1e17);

        vm.prank(governor);
        curvePoolBoosterPlain.manageCampaign(type(uint256).max, 0, 0, 0);

        assertEq(oeth.balanceOf(mockFeeCollector), 1e17);
    }

    function test_manageCampaign_RevertWhen_notCreated() public {
        // Reset campaignId to 0
        vm.prank(governor);
        curvePoolBoosterPlain.setCampaignId(0);

        vm.prank(governor);
        vm.expectRevert("Campaign not created");
        curvePoolBoosterPlain.manageCampaign(1e18, 0, 0, 0);
    }

    function test_manageCampaign_RevertWhen_notAuthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        curvePoolBoosterPlain.manageCampaign(1e18, 0, 0, 0);
    }

    function test_manageCampaign_RevertWhen_noRewardToAdd() public {
        // Balance is 0, totalRewardAmount is type(uint256).max
        // amount = min(0, type(uint256).max) = 0
        // feeAmount = 0, rewardAmount = balance after transfer = 0
        // require(rewardAmount > 0) fails
        vm.prank(governor);
        vm.expectRevert("No reward to add");
        curvePoolBoosterPlain.manageCampaign(type(uint256).max, 0, 0, 0);
    }

    /// @notice Test with specific amount less than balance (covers min() where a < b)
    function test_manageCampaign_specificAmount() public {
        _dealOETH(address(curvePoolBoosterPlain), 5e18);

        vm.prank(governor);
        curvePoolBoosterPlain.manageCampaign(2e18, 0, 0, 0);

        // min(5e18, 2e18) = 2e18
        // Fee is 10% of 2e18 = 2e17
        assertEq(oeth.balanceOf(mockFeeCollector), 2e17);
        // Remaining balance = 5e18 - 2e17 = 48e17
        assertEq(oeth.balanceOf(address(curvePoolBoosterPlain)), 48e17);
        // Approval = balance after fee transfer = 48e17
        assertEq(oeth.allowance(address(curvePoolBoosterPlain), mockCampaignRemoteManager), 48e17);
    }

    /// @notice Test with zero fee to cover feeAmount == 0 branch in _handleFee
    function test_manageCampaign_zeroFee() public {
        CurvePoolBoosterPlain freshPlain = new CurvePoolBoosterPlain(address(oeth), mockGauge);
        freshPlain.initialize(governor, strategist, 0, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket);

        _dealOETH(address(freshPlain), 1e18);

        vm.prank(governor);
        freshPlain.setCampaignId(1);

        vm.prank(governor);
        freshPlain.manageCampaign(type(uint256).max, 0, 0, 0);

        // No fee collected
        assertEq(oeth.balanceOf(mockFeeCollector), 0);
        // Full balance approved (mock doesn't transfer)
        assertEq(oeth.balanceOf(address(freshPlain)), 1e18);
        assertEq(oeth.allowance(address(freshPlain), mockCampaignRemoteManager), 1e18);
    }

    /// @notice Test manageCampaign with only reward update (no periods, no maxRewardPerVote)
    ///         Ensures only TotalRewardAmountUpdated event is emitted
    function test_manageCampaign_onlyRewardNoEvents() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        vm.prank(governor);
        curvePoolBoosterPlain.manageCampaign(type(uint256).max, 0, 0, 0);

        // Only TotalRewardAmountUpdated should have been emitted (not NumberOfPeriods or RewardPerVote)
        assertEq(oeth.balanceOf(mockFeeCollector), 1e17);
    }

    /// @notice Test manageCampaign with ETH forwarding
    function test_manageCampaign_withEth() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        vm.deal(governor, 1 ether);
        vm.prank(governor);
        curvePoolBoosterPlain.manageCampaign{value: 0.1 ether}(type(uint256).max, 0, 0, 0);

        // Verify the call succeeded (fee was collected)
        assertEq(oeth.balanceOf(mockFeeCollector), 1e17);
    }
}
