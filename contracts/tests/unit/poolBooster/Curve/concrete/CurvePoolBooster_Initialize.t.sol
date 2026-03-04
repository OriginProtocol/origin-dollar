// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.sol";
import {CurvePoolBooster} from "contracts/poolBooster/curve/CurvePoolBooster.sol";
import {CurvePoolBoosterPlain} from "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol";
import {ICampaignRemoteManager} from "contracts/interfaces/ICampaignRemoteManager.sol";

contract Unit_Concrete_CurvePoolBooster_Initialize_Test is Unit_Curve_Shared_Test {
    function test_initialize() public view {
        assertEq(curvePoolBoosterPlain.governor(), governor);
        assertEq(curvePoolBoosterPlain.strategistAddr(), strategist);
        assertEq(curvePoolBoosterPlain.fee(), DEFAULT_FEE);
        assertEq(curvePoolBoosterPlain.feeCollector(), mockFeeCollector);
        assertEq(curvePoolBoosterPlain.campaignRemoteManager(), mockCampaignRemoteManager);
        assertEq(curvePoolBoosterPlain.votemarket(), mockVotemarket);
    }

    function test_initialize_events() public {
        CurvePoolBoosterPlain freshPlain = new CurvePoolBoosterPlain(address(oeth), mockGauge);

        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.FeeUpdated(DEFAULT_FEE);
        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.FeeCollectorUpdated(mockFeeCollector);
        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.CampaignRemoteManagerUpdated(mockCampaignRemoteManager);
        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.VotemarketUpdated(mockVotemarket);

        freshPlain.initialize(governor, strategist, DEFAULT_FEE, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket);
    }

    function test_initialize_RevertWhen_notGovernor() public {
        CurvePoolBooster freshBooster = new CurvePoolBooster(address(oeth), mockGauge);
        _setGovernorViaSlot(address(freshBooster), governor);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        freshBooster.initialize(strategist, DEFAULT_FEE, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket);
    }

    function test_initialize_RevertWhen_doubleInit() public {
        vm.expectRevert("Initializable: contract is already initialized");
        curvePoolBoosterPlain.initialize(
            governor, strategist, DEFAULT_FEE, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket
        );
    }

    function test_initialize_RevertWhen_feeTooHigh() public {
        CurvePoolBoosterPlain freshPlain = new CurvePoolBoosterPlain(address(oeth), mockGauge);

        vm.expectRevert("Fee too high");
        freshPlain.initialize(governor, strategist, 5001, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket);
    }

    function test_initialize_RevertWhen_zeroFeeCollector() public {
        CurvePoolBoosterPlain freshPlain = new CurvePoolBoosterPlain(address(oeth), mockGauge);

        vm.expectRevert("Invalid fee collector");
        freshPlain.initialize(governor, strategist, DEFAULT_FEE, address(0), mockCampaignRemoteManager, mockVotemarket);
    }

    function test_initialize_RevertWhen_zeroCampaignRemoteManager() public {
        CurvePoolBoosterPlain freshPlain = new CurvePoolBoosterPlain(address(oeth), mockGauge);

        vm.expectRevert("Invalid campaignRemoteManager");
        freshPlain.initialize(governor, strategist, DEFAULT_FEE, mockFeeCollector, address(0), mockVotemarket);
    }

    function test_initialize_RevertWhen_zeroVotemarket() public {
        CurvePoolBoosterPlain freshPlain = new CurvePoolBoosterPlain(address(oeth), mockGauge);

        vm.expectRevert("Invalid votemarket");
        freshPlain.initialize(governor, strategist, DEFAULT_FEE, mockFeeCollector, mockCampaignRemoteManager, address(0));
    }

    /// @notice Test CurvePoolBooster.initialize (not CurvePoolBoosterPlain)
    ///         which has the onlyGovernor modifier and 5 params (no governor param).
    function test_initialize_curvePoolBooster() public {
        CurvePoolBooster freshBooster = new CurvePoolBooster(address(oeth), mockGauge);
        _setGovernorViaSlot(address(freshBooster), governor);

        vm.prank(governor);
        freshBooster.initialize(strategist, DEFAULT_FEE, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket);

        assertEq(freshBooster.strategistAddr(), strategist);
        assertEq(freshBooster.fee(), DEFAULT_FEE);
        assertEq(freshBooster.feeCollector(), mockFeeCollector);
        assertEq(freshBooster.campaignRemoteManager(), mockCampaignRemoteManager);
        assertEq(freshBooster.votemarket(), mockVotemarket);
    }

    function test_initialize_curvePoolBooster_RevertWhen_doubleInit() public {
        CurvePoolBooster freshBooster = new CurvePoolBooster(address(oeth), mockGauge);
        _setGovernorViaSlot(address(freshBooster), governor);

        vm.prank(governor);
        freshBooster.initialize(strategist, DEFAULT_FEE, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket);

        vm.prank(governor);
        vm.expectRevert("Initializable: contract is already initialized");
        freshBooster.initialize(strategist, DEFAULT_FEE, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket);
    }
}
