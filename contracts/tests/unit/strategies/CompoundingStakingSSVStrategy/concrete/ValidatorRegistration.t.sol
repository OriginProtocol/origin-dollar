// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_CompoundingStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";
import {ICompoundingStakingSSVStrategy} from "contracts/interfaces/strategies/ICompoundingStakingSSVStrategy.sol";
import {CompoundingValidatorState as ValidatorState} from "contracts/interfaces/strategies/CompoundingStakingTypes.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_ValidatorRegistration_Test is
    Unit_CompoundingStakingSSVStrategy_Shared_Test
{
    function setUp() public override {
        super.setUp();
        // Fund strategy with SSV tokens for registration
        deal(address(mockSsv), address(compoundingStakingSSVStrategy), 1000 ether);
    }

    function test_registerSsvValidator() public {
        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);

        vm.prank(governor);
        vm.expectEmit(true, false, false, true);
        emit ICompoundingStakingSSVStrategy.SSVValidatorRegistered(pubKeyHash, _operatorIds());
        compoundingStakingSSVStrategy.registerSsvValidator(
            testValidators[0].publicKey, _operatorIds(), testValidators[0].sharesData, _emptyCluster()
        );

        // State should be REGISTERED (1)
        (ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 1);
    }

    function test_registerSsvValidator_RevertWhen_duplicate() public {
        _registerValidator(0);

        vm.prank(governor);
        vm.expectRevert("Validator already registered");
        compoundingStakingSSVStrategy.registerSsvValidator(
            testValidators[0].publicKey, _operatorIds(), testValidators[0].sharesData, _emptyCluster()
        );
    }

    function test_registerSsvValidator_RevertWhen_notRegistrator() public {
        vm.prank(josh);
        vm.expectRevert("Not Registrator");
        compoundingStakingSSVStrategy.registerSsvValidator(
            testValidators[0].publicKey, _operatorIds(), testValidators[0].sharesData, _emptyCluster()
        );
    }

    function test_registerSsvValidator_RevertWhen_paused() public {
        vm.prank(governor);
        compoundingStakingSSVStrategy.pause();

        vm.prank(governor);
        vm.expectRevert("Pausable: paused");
        compoundingStakingSSVStrategy.registerSsvValidator(
            testValidators[0].publicKey, _operatorIds(), testValidators[0].sharesData, _emptyCluster()
        );
    }

    function test_removeSsvValidator_fromRegistered() public {
        _registerValidator(0);

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);

        vm.prank(governor);
        vm.expectEmit(true, false, false, true);
        emit ICompoundingStakingSSVStrategy.SSVValidatorRemoved(pubKeyHash, _operatorIds());
        compoundingStakingSSVStrategy.removeSsvValidator(testValidators[0].publicKey, _operatorIds(), _emptyCluster());

        // State should be REMOVED (7)
        (ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 7);
    }

    function test_removeSsvValidator_RevertWhen_staked() public {
        _registerAndStake(0);

        vm.prank(governor);
        vm.expectRevert("Validator not regd or exited");
        compoundingStakingSSVStrategy.removeSsvValidator(testValidators[0].publicKey, _operatorIds(), _emptyCluster());
    }

    function test_removeSsvValidator_RevertWhen_notRegistrator() public {
        _registerValidator(0);

        vm.prank(josh);
        vm.expectRevert("Not Registrator");
        compoundingStakingSSVStrategy.removeSsvValidator(testValidators[0].publicKey, _operatorIds(), _emptyCluster());
    }

    function test_removeSsvValidator_RevertWhen_notRegistered() public {
        // Try to remove a validator that was never registered (NON_REGISTERED state = 0)
        vm.prank(governor);
        vm.expectRevert("Validator not regd or exited");
        compoundingStakingSSVStrategy.removeSsvValidator(testValidators[0].publicKey, _operatorIds(), _emptyCluster());
    }

    function test_removeSsvValidator_fromInvalid() public {
        // Register and stake validator 0
        _registerAndStake(0);

        bytes memory publicKey = testValidators[0].publicKey;
        bytes32 pubKeyHash = _hashPubKey(publicKey);

        // Verify validator with WRONG withdrawal credentials (attacker's address)
        uint64 nextBlockTimestamp = uint64(block.timestamp);
        bytes32 wrongCredentials = bytes32(abi.encodePacked(bytes1(0x02), bytes11(0), josh));

        compoundingStakingSSVStrategy.verifyValidator(nextBlockTimestamp, 100, pubKeyHash, wrongCredentials, hex"00");

        // Validator should now be INVALID (8)
        (ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 8, "Should be INVALID");

        // Remove the invalid validator - should succeed (INVALID → REMOVED)
        vm.prank(governor);
        vm.expectEmit(true, false, false, true);
        emit ICompoundingStakingSSVStrategy.SSVValidatorRemoved(pubKeyHash, _operatorIds());
        compoundingStakingSSVStrategy.removeSsvValidator(publicKey, _operatorIds(), _emptyCluster());

        // State should be REMOVED (7)
        (ValidatorState stateAfter,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(stateAfter), 7, "Should be REMOVED");
    }

    function test_removeSsvValidator_fromExited() public {
        // Process validator 0 fully (register, stake, verify validator, verify deposit)
        _processValidator(0, 100);

        // Activate the validator: advance time, snap, verifyBalances with 1 validator
        _activateValidator();

        // Set validator balance to 0 (type(uint256).max is the "zero" sentinel in MockBeaconProofs)
        mockBeaconProofs.setValidatorBalance(uint40(100), type(uint256).max);

        // Advance time, snap, verifyBalances → validator becomes EXITED (6)
        vm.warp(block.timestamp + 500);
        _snapBalances();
        _verifyBalances(_emptyBalanceProofs(1), _emptyPendingDepositProofs(0));

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);

        // Validator should be EXITED (6)
        (ValidatorState stateExited,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(stateExited), 6, "Should be EXITED");

        // Verified validators list should be empty
        assertEq(compoundingStakingSSVStrategy.verifiedValidatorsLength(), 0);

        // Remove the exited validator as governor → should succeed
        vm.prank(governor);
        vm.expectEmit(true, false, false, true);
        emit ICompoundingStakingSSVStrategy.SSVValidatorRemoved(pubKeyHash, _operatorIds());
        compoundingStakingSSVStrategy.removeSsvValidator(testValidators[0].publicKey, _operatorIds(), _emptyCluster());

        // State should be REMOVED (7)
        (ValidatorState stateRemoved,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(stateRemoved), 7, "Should be REMOVED");
    }

    function test_removeSsvValidator_RevertWhen_verified() public {
        // Process validator through full flow → state is VERIFIED (3)
        _processValidator(0, 100);

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        (ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 3, "Should be VERIFIED");

        // Try removeSsvValidator → should revert
        vm.prank(governor);
        vm.expectRevert("Validator not regd or exited");
        compoundingStakingSSVStrategy.removeSsvValidator(testValidators[0].publicKey, _operatorIds(), _emptyCluster());
    }

    function test_removeStrategy_RevertWhen_hasFunds() public {
        // Register and stake validator 0 (deposits 1 ETH to strategy)
        _registerAndStake(0);

        // Try to remove the strategy from vault → should revert because strategy has funds
        vm.prank(governor);
        vm.expectRevert("Strategy has funds");
        oethVault.removeStrategy(address(compoundingStakingSSVStrategy));
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Activate a processed validator by advancing time, snapping, and verifying balances
    function _activateValidator() internal {
        vm.warp(block.timestamp + 500);
        _snapBalances();
        _verifyBalances(_emptyBalanceProofs(1), _emptyPendingDepositProofs(0));
    }

    // ----------------
    // Events
    // ----------------

    event SSVValidatorRegistered(bytes32 indexed pubKeyHash, uint64[] operatorIds);
    event SSVValidatorRemoved(bytes32 indexed pubKeyHash, uint64[] operatorIds);
}
