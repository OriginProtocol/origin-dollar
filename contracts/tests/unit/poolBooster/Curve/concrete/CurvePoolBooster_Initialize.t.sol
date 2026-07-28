// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";

// --- Project imports
import {ICurvePoolBooster} from "contracts/interfaces/poolBooster/ICurvePoolBooster.sol";

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
        ICurvePoolBooster freshPlain = _deployFreshCurvePoolBoosterPlain();

        vm.expectEmit(true, true, true, true);
        emit ICurvePoolBooster.FeeUpdated(DEFAULT_FEE);
        vm.expectEmit(true, true, true, true);
        emit ICurvePoolBooster.FeeCollectorUpdated(mockFeeCollector);
        vm.expectEmit(true, true, true, true);
        emit ICurvePoolBooster.CampaignRemoteManagerUpdated(mockCampaignRemoteManager);
        vm.expectEmit(true, true, true, true);
        emit ICurvePoolBooster.VotemarketUpdated(mockVotemarket);

        freshPlain.initialize(
            governor, strategist, DEFAULT_FEE, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket
        );
    }

    function test_initialize_RevertWhen_notGovernor() public {
        ICurvePoolBooster freshBooster = _deployFreshCurvePoolBooster();
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
        ICurvePoolBooster freshPlain = _deployFreshCurvePoolBoosterPlain();

        vm.expectRevert("Fee too high");
        freshPlain.initialize(governor, strategist, 5001, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket);
    }

    function test_initialize_RevertWhen_zeroFeeCollector() public {
        ICurvePoolBooster freshPlain = _deployFreshCurvePoolBoosterPlain();

        vm.expectRevert("Invalid fee collector");
        freshPlain.initialize(governor, strategist, DEFAULT_FEE, address(0), mockCampaignRemoteManager, mockVotemarket);
    }

    function test_initialize_RevertWhen_zeroCampaignRemoteManager() public {
        ICurvePoolBooster freshPlain = _deployFreshCurvePoolBoosterPlain();

        vm.expectRevert("Invalid campaignRemoteManager");
        freshPlain.initialize(governor, strategist, DEFAULT_FEE, mockFeeCollector, address(0), mockVotemarket);
    }

    function test_initialize_RevertWhen_zeroVotemarket() public {
        ICurvePoolBooster freshPlain = _deployFreshCurvePoolBoosterPlain();

        vm.expectRevert("Invalid votemarket");
        freshPlain.initialize(
            governor, strategist, DEFAULT_FEE, mockFeeCollector, mockCampaignRemoteManager, address(0)
        );
    }

    /// @notice Test CurvePoolBooster.initialize (not CurvePoolBoosterPlain)
    ///         which has the onlyGovernor modifier and 5 params (no governor param).
    function test_initialize_curvePoolBooster() public {
        ICurvePoolBooster freshBooster = _deployFreshCurvePoolBooster();
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
        ICurvePoolBooster freshBooster = _deployFreshCurvePoolBooster();
        _setGovernorViaSlot(address(freshBooster), governor);

        vm.prank(governor);
        freshBooster.initialize(strategist, DEFAULT_FEE, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket);

        vm.prank(governor);
        vm.expectRevert("Initializable: contract is already initialized");
        freshBooster.initialize(strategist, DEFAULT_FEE, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket);
    }
}
