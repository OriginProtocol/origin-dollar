// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_SetXOGNRewardRateModule_Shared_Test
} from "tests/unit/automation/SetXOGNRewardRateModule/shared/Shared.t.sol";

// --- Project imports
import {ISetXOGNRewardRateModule} from "contracts/interfaces/automation/ISetXOGNRewardRateModule.sol";

contract Unit_Concrete_SetXOGNRewardRateModule_SetBounds_Test is Unit_SetXOGNRewardRateModule_Shared_Test {
    function test_setBounds_updatesAll() public {
        vm.prank(address(mockSafe));
        module.setBounds(0.5e18, 4e18, 1000, 1 days);

        assertEq(uint256(module.minRate()), 0.5e18);
        assertEq(uint256(module.maxRate()), 4e18);
        assertEq(uint256(module.maxStepBps()), 1000);
        assertEq(module.minRunway(), 1 days);
    }

    function test_setBounds_emitsEvent() public {
        vm.expectEmit({emitter: address(module)});
        emit ISetXOGNRewardRateModule.BoundsSet(0.5e18, 4e18, 1000, 1 days);

        vm.prank(address(mockSafe));
        module.setBounds(0.5e18, 4e18, 1000, 1 days);
    }

    function test_setBounds_allowsEqualMinAndMax() public {
        vm.prank(address(mockSafe));
        module.setBounds(1e18, 1e18, 1e4, 1 hours);

        assertEq(uint256(module.minRate()), uint256(module.maxRate()));
    }

    function test_setBounds_RevertWhen_minAboveMax() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Invalid rate bounds");
        module.setBounds(4e18, 1e18, 1000, 1 days);
    }

    function test_setBounds_RevertWhen_zeroStep() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Invalid step");
        module.setBounds(0.5e18, 4e18, 0, 1 days);
    }

    function test_setBounds_RevertWhen_stepAboveHundredPercent() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Invalid step");
        module.setBounds(0.5e18, 4e18, 1e4 + 1, 1 days);
    }

    function test_setBounds_RevertWhen_zeroRunway() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Invalid runway");
        module.setBounds(0.5e18, 4e18, 1000, 0);
    }

    /// @dev The operator can move the rate but must not be able to widen its own
    ///      leash. Only the Safe can.
    function test_setBounds_RevertWhen_notSafe() public {
        vm.prank(operator);
        vm.expectRevert("Caller is not the safe contract");
        module.setBounds(0.5e18, 4e18, 1000, 1 days);
    }

    function test_setBounds_RevertWhen_randomCaller() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the safe contract");
        module.setBounds(0.5e18, 4e18, 1000, 1 days);
    }
}
