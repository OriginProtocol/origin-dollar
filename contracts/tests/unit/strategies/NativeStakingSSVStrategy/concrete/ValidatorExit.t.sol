// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_NativeStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_NativeStakingSSVStrategy_ValidatorExit_Test
    is Unit_NativeStakingSSVStrategy_Shared_Test
{
    function setUp() public override {
        super.setUp();

        // Fund strategy
        deal(address(mockSsv), address(nativeStakingSSVStrategy), 1000 ether);
        vm.prank(josh);
        weth.transfer(address(nativeStakingSSVStrategy), 256 ether);
    }

    function test_exitSsvValidator() public {
        _registerAndStakeValidator(0);

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit SSVValidatorExitInitiated(keccak256(testPublicKeys[0]), testPublicKeys[0], _operatorIds());
        nativeStakingSSVStrategy.exitSsvValidator(testPublicKeys[0], _operatorIds());

        // State should be EXITING
        assertEq(
            uint256(nativeStakingSSVStrategy.validatorsStates(keccak256(testPublicKeys[0]))), 3
        );
    }

    function test_exitSsvValidator_RevertWhen_notStaked() public {
        _registerValidator(0);

        vm.prank(governor);
        vm.expectRevert("Validator not staked");
        nativeStakingSSVStrategy.exitSsvValidator(testPublicKeys[0], _operatorIds());
    }

    function test_removeSsvValidator_fromExiting() public {
        _registerAndStakeValidator(0);

        // Exit first
        vm.prank(governor);
        nativeStakingSSVStrategy.exitSsvValidator(testPublicKeys[0], _operatorIds());

        // Remove
        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit SSVValidatorExitCompleted(keccak256(testPublicKeys[0]), testPublicKeys[0], _operatorIds());
        nativeStakingSSVStrategy.removeSsvValidator(testPublicKeys[0], _operatorIds(), _emptyCluster());

        // State should be EXIT_COMPLETE
        assertEq(
            uint256(nativeStakingSSVStrategy.validatorsStates(keccak256(testPublicKeys[0]))), 4
        );
    }

    function test_removeSsvValidator_fromRegistered() public {
        _registerValidator(0);

        vm.prank(governor);
        nativeStakingSSVStrategy.removeSsvValidator(testPublicKeys[0], _operatorIds(), _emptyCluster());

        // State should be EXIT_COMPLETE
        assertEq(
            uint256(nativeStakingSSVStrategy.validatorsStates(keccak256(testPublicKeys[0]))), 4
        );
    }

    function test_removeSsvValidator_RevertWhen_staked() public {
        _registerAndStakeValidator(0);

        vm.prank(governor);
        vm.expectRevert("Validator not regd or exiting");
        nativeStakingSSVStrategy.removeSsvValidator(testPublicKeys[0], _operatorIds(), _emptyCluster());
    }

    // ----------------
    // Events
    // ----------------

    event SSVValidatorExitInitiated(bytes32 indexed pubKeyHash, bytes pubKey, uint64[] operatorIds);
    event SSVValidatorExitCompleted(bytes32 indexed pubKeyHash, bytes pubKey, uint64[] operatorIds);
}
