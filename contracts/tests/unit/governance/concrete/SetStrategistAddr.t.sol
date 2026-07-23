// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Governance_Shared_Test} from "tests/unit/governance/shared/Shared.t.sol";

// --- Project imports
import {Strategizable} from "contracts/governance/Strategizable.sol";

contract Unit_Concrete_Governance_SetStrategistAddr_Test is Unit_Governance_Shared_Test {
    // --- setStrategistAddr ---

    function test_setStrategistAddr() public {
        vm.prank(governor);
        strategizable.setStrategistAddr(strategist);

        assertEq(strategizable.strategistAddr(), strategist);
    }

    function test_setStrategistAddr_emitsStrategistUpdated() public {
        vm.expectEmit(true, true, true, true);
        emit Strategizable.StrategistUpdated(strategist);

        vm.prank(governor);
        strategizable.setStrategistAddr(strategist);
    }

    function test_setStrategistAddr_RevertWhen_notGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        strategizable.setStrategistAddr(strategist);
    }

    function test_setStrategistAddr_zeroAddressAllowed() public {
        // First set a strategist
        vm.prank(governor);
        strategizable.setStrategistAddr(strategist);

        // Then set to zero address (allowed)
        vm.prank(governor);
        strategizable.setStrategistAddr(address(0));

        assertEq(strategizable.strategistAddr(), address(0));
    }
}
