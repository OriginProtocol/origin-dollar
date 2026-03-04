// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.sol";
import {CurvePoolBoosterPlain} from "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol";

contract Unit_Concrete_CurvePoolBoosterPlain_Initialize_Test is Unit_Curve_Shared_Test {
    function test_initialize() public {
        // Deploy a fresh CurvePoolBoosterPlain and initialize it
        CurvePoolBoosterPlain freshPlain = new CurvePoolBoosterPlain(address(oeth), mockGauge);

        // Before initialize, governor is address(0) because parent constructor calls _setGovernor(address(0))
        assertEq(freshPlain.governor(), address(0));

        freshPlain.initialize(
            governor, strategist, DEFAULT_FEE, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket
        );

        // After initialize, governor should be set (unlike CurvePoolBooster where governor stays 0 in constructor)
        assertEq(freshPlain.governor(), governor);
        assertEq(freshPlain.strategistAddr(), strategist);
        assertEq(freshPlain.fee(), DEFAULT_FEE);
        assertEq(freshPlain.feeCollector(), mockFeeCollector);
        assertEq(freshPlain.campaignRemoteManager(), mockCampaignRemoteManager);
        assertEq(freshPlain.votemarket(), mockVotemarket);
    }

    function test_initialize_noRoleCheck() public {
        // Anyone can call initialize (no onlyGovernor modifier) -- it's expected to be called
        // in the same transaction as deployment
        CurvePoolBoosterPlain freshPlain = new CurvePoolBoosterPlain(address(oeth), mockGauge);

        // Call initialize as alice (not governor) -- should succeed
        vm.prank(alice);
        freshPlain.initialize(
            governor, strategist, DEFAULT_FEE, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket
        );

        assertEq(freshPlain.governor(), governor);
    }

    function test_initialize_RevertWhen_doubleInit() public {
        // curvePoolBoosterPlain is already initialized in shared setUp
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
}
