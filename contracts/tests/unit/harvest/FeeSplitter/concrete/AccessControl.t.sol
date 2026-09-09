// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_FeeSplitter_Shared_Test} from "tests/unit/harvest/FeeSplitter/shared/Shared.t.sol";

/// @notice Pins the split between Governor-only and Strategist-callable setters.
/// @dev The three settings that decide where money goes must stay behind the
///      timelock. Between them they can redirect 100% of protocol fees, so a
///      Strategist being able to reach any of them would defeat the point of
///      replacing the multisig fee recipient in the first place.
contract Unit_Concrete_FeeSplitter_AccessControl_Test is Unit_FeeSplitter_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- GOVERNOR ONLY
    //////////////////////////////////////////////////////

    function test_setOperationsWallet_RevertWhen_strategist() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        feeSplitter.setOperationsWallet(josh);
    }

    function test_setHarvester_RevertWhen_strategist() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        feeSplitter.setHarvester(josh);
    }

    function test_setOperationsBps_RevertWhen_strategist() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        feeSplitter.setOperationsBps(1000);
    }

    function test_rescue_RevertWhen_strategist() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        feeSplitter.rescue(address(ousd), 1);
    }

    function test_setOperationsWallet_allowedForGovernor() public {
        vm.prank(governor);
        feeSplitter.setOperationsWallet(josh);
        assertEq(feeSplitter.operationsWallet(), josh);
    }

    function test_setHarvester_allowedForGovernor() public {
        vm.prank(governor);
        feeSplitter.setHarvester(josh);
        assertEq(feeSplitter.harvester(), josh);
    }

    function test_setOperationsBps_allowedForGovernor() public {
        vm.prank(governor);
        feeSplitter.setOperationsBps(1000);
        assertEq(feeSplitter.operationsBps(), 1000);
    }

    //////////////////////////////////////////////////////
    /// --- BOUNDS ON GOVERNANCE ITSELF
    //////////////////////////////////////////////////////

    function test_setOperationsBps_RevertWhen_aboveMax() public {
        // Read before the prank: a view call inside the prank scope would
        // consume it and leave setOperationsBps unpranked.
        uint16 max = feeSplitter.MAX_OPERATIONS_BPS();

        vm.prank(governor);
        vm.expectRevert("Operations bps too high");
        feeSplitter.setOperationsBps(max + 1);
    }

    function test_setOperationsBps_allowsExactlyMax() public {
        uint16 max = feeSplitter.MAX_OPERATIONS_BPS();

        vm.prank(governor);
        feeSplitter.setOperationsBps(max);

        assertEq(feeSplitter.operationsBps(), max);
    }

    function test_setOperationsBps_allowsZero() public {
        vm.prank(governor);
        feeSplitter.setOperationsBps(0);

        ousd.mint(address(feeSplitter), 1000e18);
        vm.prank(operator);
        feeSplitter.distribute();

        assertEq(ousd.balanceOf(operationsWallet), 0);
        assertEq(ousd.balanceOf(harvester), 1000e18, "everything to buyback");
    }

    function test_setOperationsWallet_RevertWhen_zeroAddress() public {
        vm.prank(governor);
        vm.expectRevert("Invalid operations wallet");
        feeSplitter.setOperationsWallet(address(0));
    }

    function test_setHarvester_RevertWhen_zeroAddress() public {
        vm.prank(governor);
        vm.expectRevert("Invalid harvester");
        feeSplitter.setHarvester(address(0));
    }

    //////////////////////////////////////////////////////
    /// --- STRATEGIST CALLABLE
    //////////////////////////////////////////////////////

    function test_setOperatorAddr_allowedForStrategist() public {
        vm.prank(strategist);
        feeSplitter.setOperatorAddr(josh);
        assertEq(feeSplitter.operatorAddr(), josh);
    }

    function test_setOperatorAddr_RevertWhen_random() public {
        vm.prank(josh);
        vm.expectRevert("Caller is not the Strategist or Governor");
        feeSplitter.setOperatorAddr(josh);
    }
}
