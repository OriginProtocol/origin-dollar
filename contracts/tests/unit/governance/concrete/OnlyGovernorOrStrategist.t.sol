// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Governance_Shared_Test} from "tests/unit/governance/shared/Shared.t.sol";

contract Unit_Concrete_Governance_OnlyGovernorOrStrategist_Test is Unit_Governance_Shared_Test {
    function setUp() public override {
        super.setUp();

        // Set strategist on the strategizable contract
        vm.prank(governor);
        strategizable.setStrategistAddr(strategist);
    }

    // --- onlyGovernorOrStrategist modifier ---

    function test_onlyGovernorOrStrategist_governorPasses() public {
        vm.prank(governor);
        uint256 result = strategizable.guardedFunction();
        assertEq(result, 1);
    }

    function test_onlyGovernorOrStrategist_strategistPasses() public {
        vm.prank(strategist);
        uint256 result = strategizable.guardedFunction();
        assertEq(result, 1);
    }

    function test_onlyGovernorOrStrategist_RevertWhen_randomCaller() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        strategizable.guardedFunction();
    }
}
