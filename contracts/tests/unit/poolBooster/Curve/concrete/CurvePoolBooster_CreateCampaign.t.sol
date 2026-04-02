// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";
import {ICurvePoolBooster} from "contracts/interfaces/poolBooster/ICurvePoolBooster.sol";

contract Unit_Concrete_CurvePoolBooster_CreateCampaign_Test is Unit_Curve_Shared_Test {
    function setUp() public override {
        super.setUp();
        _mockCampaignRemoteManager();
    }

    function test_createCampaign() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        address[] memory blacklist = new address[](0);
        vm.prank(governor);
        curvePoolBoosterPlain.createCampaign(2, 1e15, blacklist, 0);

        // Fee is 10%, so 1e17 goes to feeCollector, 9e17 remains (approved for campaign manager)
        assertEq(oeth.balanceOf(address(curvePoolBoosterPlain)), 9e17);
        assertEq(oeth.balanceOf(mockFeeCollector), 1e17);
        // Verify approval was set for campaign remote manager
        assertEq(oeth.allowance(address(curvePoolBoosterPlain), mockCampaignRemoteManager), 9e17);
    }

    function test_createCampaign_event() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        address[] memory blacklist = new address[](0);

        // Fee is 10% of 1e18 = 1e17, balance after fee = 9e17
        vm.expectEmit(true, true, true, true);
        emit ICurvePoolBooster.CampaignCreated(mockGauge, address(oeth), 1e15, 9e17);

        vm.prank(governor);
        curvePoolBoosterPlain.createCampaign(2, 1e15, blacklist, 0);
    }

    function test_createCampaign_feeDeduction() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        address[] memory blacklist = new address[](0);

        vm.expectEmit(true, true, true, true);
        emit ICurvePoolBooster.FeeCollected(mockFeeCollector, 1e17);

        vm.prank(governor);
        curvePoolBoosterPlain.createCampaign(2, 1e15, blacklist, 0);

        assertEq(oeth.balanceOf(mockFeeCollector), 1e17);
    }

    function test_createCampaign_strategistCanCall() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        address[] memory blacklist = new address[](0);
        vm.prank(strategist);
        curvePoolBoosterPlain.createCampaign(2, 1e15, blacklist, 0);

        assertEq(oeth.balanceOf(mockFeeCollector), 1e17);
    }

    function test_createCampaign_zeroFee() public {
        // Deploy a fresh booster with 0 fee
        ICurvePoolBooster freshPlain = _deployFreshCurvePoolBoosterPlain();
        freshPlain.initialize(governor, strategist, 0, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket);

        _dealOETH(address(freshPlain), 1e18);

        address[] memory blacklist = new address[](0);
        vm.prank(governor);
        freshPlain.createCampaign(2, 1e15, blacklist, 0);

        // No fee, full balance approved for campaign (mock doesn't transfer)
        assertEq(oeth.balanceOf(address(freshPlain)), 1e18);
        assertEq(oeth.balanceOf(mockFeeCollector), 0);
        assertEq(oeth.allowance(address(freshPlain), mockCampaignRemoteManager), 1e18);
    }

    function test_createCampaign_RevertWhen_notAuthorized() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        address[] memory blacklist = new address[](0);
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        curvePoolBoosterPlain.createCampaign(2, 1e15, blacklist, 0);
    }

    function test_createCampaign_RevertWhen_alreadyCreated() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        // Set campaignId to non-zero
        vm.prank(governor);
        curvePoolBoosterPlain.setCampaignId(1);

        address[] memory blacklist = new address[](0);
        vm.prank(governor);
        vm.expectRevert("Campaign already created");
        curvePoolBoosterPlain.createCampaign(2, 1e15, blacklist, 0);
    }

    function test_createCampaign_RevertWhen_tooFewPeriods() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        address[] memory blacklist = new address[](0);
        vm.prank(governor);
        vm.expectRevert("Invalid number of periods");
        curvePoolBoosterPlain.createCampaign(1, 1e15, blacklist, 0);
    }

    function test_createCampaign_RevertWhen_zeroRewardPerVote() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        address[] memory blacklist = new address[](0);
        vm.prank(governor);
        vm.expectRevert("Invalid reward per vote");
        curvePoolBoosterPlain.createCampaign(2, 0, blacklist, 0);
    }

    /// @notice Test that createCampaign accepts and forwards ETH
    function test_createCampaign_withEth() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        address[] memory blacklist = new address[](0);
        vm.deal(governor, 1 ether);
        vm.prank(governor);
        curvePoolBoosterPlain.createCampaign{value: 0.1 ether}(2, 1e15, blacklist, 0);

        // Verify the call succeeded (campaign was created)
        assertEq(oeth.balanceOf(mockFeeCollector), 1e17);
    }

    /// @notice Test campaign creation with a blacklist
    function test_createCampaign_withBlacklist() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        address[] memory blacklist = new address[](2);
        blacklist[0] = alice;
        blacklist[1] = bobby;

        vm.prank(governor);
        curvePoolBoosterPlain.createCampaign(2, 1e15, blacklist, 0);

        assertEq(oeth.balanceOf(mockFeeCollector), 1e17);
    }

    /// @notice Test campaign creation with max periods (uint8.max = 255)
    function test_createCampaign_maxPeriods() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        address[] memory blacklist = new address[](0);
        vm.prank(governor);
        curvePoolBoosterPlain.createCampaign(255, 1e15, blacklist, 0);

        assertEq(oeth.balanceOf(mockFeeCollector), 1e17);
    }

    /// @notice Test campaign creation with boundary period value (2 = minimum valid)
    function test_createCampaign_RevertWhen_zeroPeriods() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        address[] memory blacklist = new address[](0);
        vm.prank(governor);
        vm.expectRevert("Invalid number of periods");
        curvePoolBoosterPlain.createCampaign(0, 1e15, blacklist, 0);
    }
}
