// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";

// --- Project imports
import {
    CompoundingFirstPendingDepositSlotProofData as FirstPendingDepositSlotProofData,
    CompoundingStrategyValidatorProofData as StrategyValidatorProofData,
    CompoundingValidatorState as ValidatorState
} from "contracts/interfaces/strategies/CompoundingStakingTypes.sol";
import {ICompoundingStakingSSVStrategy} from "contracts/interfaces/strategies/ICompoundingStakingSSVStrategy.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_FrontRunAndInvalid_Test is
    Unit_CompoundingStakingSSVStrategy_Shared_Test
{
    function setUp() public override {
        super.setUp();
        // Fund strategy with SSV tokens for registration
        deal(address(mockSsv), address(compoundingStakingSSVStrategy), 1000 ether);
        // Fund governor with ETH for withdrawal request fees
        vm.deal(governor, 10 ether);
    }

    // ----------------
    // Tests
    // ----------------

    /// @dev Front-run deposit: attacker registers with their own withdrawal credentials.
    ///      verifyValidator should mark the validator as INVALID, remove the pending deposit,
    ///      reduce lastVerifiedEthBalance, and leave firstDeposit as true.
    function test_verifyValidator_frontRunDeposit() public {
        // Register and stake validator 3
        bytes32 pendingDepositRoot = _registerAndStake(3);
        bytes32 pubKeyHash = _hashPubKey(testValidators[3].publicKey);

        // Attacker's withdrawal credentials
        bytes32 attackerCredentials = bytes32(abi.encodePacked(bytes1(0x02), bytes11(0), josh));

        uint256 depositListLenBefore = compoundingStakingSSVStrategy.depositListLength();
        uint256 lastVerifiedBefore = compoundingStakingSSVStrategy.lastVerifiedEthBalance();

        // Verify validator with attacker's credentials
        uint64 nextBlockTimestamp = uint64(block.timestamp);
        uint40 validatorIndex = uint40(testValidators[3].index);

        vm.expectEmit(true, false, false, false);
        emit ICompoundingStakingSSVStrategy.ValidatorInvalid(pubKeyHash);
        compoundingStakingSSVStrategy.verifyValidator(
            nextBlockTimestamp, validatorIndex, pubKeyHash, attackerCredentials, hex"00"
        );

        // Validator should be INVALID (8)
        (ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 8, "Should be INVALID");

        // Pending deposit should be removed
        uint256 depositListLenAfter = compoundingStakingSSVStrategy.depositListLength();
        assertEq(depositListLenAfter, depositListLenBefore - 1, "Deposit should be removed from list");

        // lastVerifiedEthBalance should be reduced by 1 ether
        uint256 lastVerifiedAfter = compoundingStakingSSVStrategy.lastVerifiedEthBalance();
        assertEq(lastVerifiedAfter, lastVerifiedBefore - 1 ether, "lastVerifiedEthBalance should decrease by 1 ether");

        // firstDeposit should still be true (NOT reset)
        assertTrue(compoundingStakingSSVStrategy.firstDeposit(), "firstDeposit should remain true");
    }

    /// @dev Incorrect credential type: 0x01 instead of 0x02.
    ///      Should mark validator as INVALID.
    function test_verifyValidator_incorrectType() public {
        _registerAndStake(3);
        bytes32 pubKeyHash = _hashPubKey(testValidators[3].publicKey);

        // Wrong type: 0x01 instead of 0x02
        bytes32 wrongTypeCredentials =
            bytes32(abi.encodePacked(bytes1(0x01), bytes11(0), address(compoundingStakingSSVStrategy)));

        uint64 nextBlockTimestamp = uint64(block.timestamp);
        uint40 validatorIndex = uint40(testValidators[3].index);

        vm.expectEmit(true, false, false, false);
        emit ICompoundingStakingSSVStrategy.ValidatorInvalid(pubKeyHash);
        compoundingStakingSSVStrategy.verifyValidator(
            nextBlockTimestamp, validatorIndex, pubKeyHash, wrongTypeCredentials, hex"00"
        );

        // Validator should be INVALID (8)
        (ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 8, "Should be INVALID");
    }

    /// @dev Malformed credentials: correct type 0x02 but wrong padding.
    ///      Should mark validator as INVALID.
    function test_verifyValidator_malformedCredentials() public {
        _registerAndStake(3);
        bytes32 pubKeyHash = _hashPubKey(testValidators[3].publicKey);

        // Correct type 0x02 but non-zero padding byte
        bytes32 malformedCredentials =
            bytes32(abi.encodePacked(bytes1(0x02), bytes1(0x01), bytes10(0), address(compoundingStakingSSVStrategy)));

        uint64 nextBlockTimestamp = uint64(block.timestamp);
        uint40 validatorIndex = uint40(testValidators[3].index);

        vm.expectEmit(true, false, false, false);
        emit ICompoundingStakingSSVStrategy.ValidatorInvalid(pubKeyHash);
        compoundingStakingSSVStrategy.verifyValidator(
            nextBlockTimestamp, validatorIndex, pubKeyHash, malformedCredentials, hex"00"
        );

        // Validator should be INVALID (8)
        (ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 8, "Should be INVALID");
    }

    /// @dev After front-run makes validator INVALID, verifyDeposit should revert
    ///      because the pending deposit was already removed during verifyValidator.
    function test_verifyDeposit_RevertWhen_frontRunInvalid() public {
        // Register and stake validator 3, capture the pending deposit root
        bytes32 pendingDepositRoot = _registerAndStake(3);
        bytes32 pubKeyHash = _hashPubKey(testValidators[3].publicKey);

        // Verify validator with wrong credentials -> INVALID, deposit removed
        bytes32 attackerCredentials = bytes32(abi.encodePacked(bytes1(0x02), bytes11(0), josh));
        uint64 nextBlockTimestamp = uint64(block.timestamp);
        uint40 validatorIndex = uint40(testValidators[3].index);

        compoundingStakingSSVStrategy.verifyValidator(
            nextBlockTimestamp, validatorIndex, pubKeyHash, attackerCredentials, hex"00"
        );

        // Now try to verify the deposit - should revert since it was removed
        (,, uint64 depositSlot,,) = compoundingStakingSSVStrategy.deposits(pendingDepositRoot);

        uint64 processedSlot = depositSlot + 10_000;

        bytes memory emptyQueueProof = new bytes(1184);
        FirstPendingDepositSlotProofData memory firstPending =
            FirstPendingDepositSlotProofData({slot: 1, proof: emptyQueueProof});

        StrategyValidatorProofData memory strategyValidator =
            StrategyValidatorProofData({withdrawableEpoch: type(uint64).max, withdrawableEpochProof: hex"00"});

        vm.expectRevert("Deposit not pending");
        compoundingStakingSSVStrategy.verifyDeposit(pendingDepositRoot, processedSlot, firstPending, strategyValidator);
    }

    /// @dev After front-run, firstDeposit is still true. Governor can reset it.
    function test_resetFirstDeposit_afterFrontRun() public {
        _registerAndStake(3);
        bytes32 pubKeyHash = _hashPubKey(testValidators[3].publicKey);

        // Verify with wrong credentials -> INVALID
        bytes32 attackerCredentials = bytes32(abi.encodePacked(bytes1(0x02), bytes11(0), josh));
        uint64 nextBlockTimestamp = uint64(block.timestamp);
        uint40 validatorIndex = uint40(testValidators[3].index);

        compoundingStakingSSVStrategy.verifyValidator(
            nextBlockTimestamp, validatorIndex, pubKeyHash, attackerCredentials, hex"00"
        );

        // firstDeposit should still be true
        assertTrue(compoundingStakingSSVStrategy.firstDeposit(), "firstDeposit should be true after front-run");

        // Governor resets firstDeposit
        vm.prank(governor);
        vm.expectEmit(false, false, false, true);
        emit ICompoundingStakingSSVStrategy.FirstDepositReset();
        compoundingStakingSSVStrategy.resetFirstDeposit();

        // firstDeposit should now be false
        assertFalse(compoundingStakingSSVStrategy.firstDeposit(), "firstDeposit should be false after reset");
    }

    /// @dev INVALID validators can be removed via removeSsvValidator.
    function test_removeSsvValidator_whenInvalid() public {
        _registerAndStake(3);
        bytes32 pubKeyHash = _hashPubKey(testValidators[3].publicKey);

        // Verify with wrong credentials -> INVALID (state 8)
        bytes32 attackerCredentials = bytes32(abi.encodePacked(bytes1(0x02), bytes11(0), josh));
        uint64 nextBlockTimestamp = uint64(block.timestamp);
        uint40 validatorIndex = uint40(testValidators[3].index);

        compoundingStakingSSVStrategy.verifyValidator(
            nextBlockTimestamp, validatorIndex, pubKeyHash, attackerCredentials, hex"00"
        );

        // Confirm INVALID state
        (ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 8, "Should be INVALID before removal");

        // Remove the invalid validator as governor
        vm.prank(governor);
        vm.expectEmit(true, false, false, true);
        emit ICompoundingStakingSSVStrategy.SSVValidatorRemoved(pubKeyHash, _operatorIds(3));
        compoundingStakingSSVStrategy.removeSsvValidator(testValidators[3].publicKey, _operatorIds(3), _emptyCluster());

        // State should be REMOVED (7)
        (ValidatorState stateAfter,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(stateAfter), 7, "Should be REMOVED after removal");
    }

    // ----------------
    // Events
    // ----------------

    event ValidatorInvalid(bytes32 indexed pubKeyHash);
    event FirstDepositReset();
    event SSVValidatorRemoved(bytes32 indexed pubKeyHash, uint64[] operatorIds);
}
