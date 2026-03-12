// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CompoundingStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";
import {CompoundingValidatorManager} from "contracts/strategies/NativeStaking/CompoundingValidatorManager.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_ValidatorExit_Test
    is Unit_CompoundingStakingSSVStrategy_Shared_Test
{
    function setUp() public override {
        super.setUp();
        deal(address(mockSsv), address(compoundingStakingSSVStrategy), 1000 ether);
        vm.deal(governor, 10 ether);
    }

    function test_validatorWithdrawal_full() public {
        // Process validator to VERIFIED, then activate via verifyBalances
        _processValidator(0, 100);
        _activateValidator(0);

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);

        vm.prank(governor);
        vm.expectEmit(true, false, false, true);
        emit ValidatorWithdraw(pubKeyHash, 0);
        compoundingStakingSSVStrategy.validatorWithdrawal{value: 1 wei}(testValidators[0].publicKey, 0);

        // State should be EXITING (5)
        (CompoundingValidatorManager.ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 5);
    }

    function test_validatorWithdrawal_partial() public {
        _processValidator(0, 100);
        _activateValidator(0);

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);

        vm.prank(governor);
        compoundingStakingSSVStrategy.validatorWithdrawal{value: 1 wei}(
            testValidators[0].publicKey, uint64(1 ether / 1 gwei)
        );

        // State should still be ACTIVE (4)
        (CompoundingValidatorManager.ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 4);
    }

    function test_validatorWithdrawal_RevertWhen_notActiveOrExiting() public {
        _registerAndStake(0);

        vm.deal(governor, 1 ether);
        vm.prank(governor);
        vm.expectRevert("Validator not active/exiting");
        compoundingStakingSSVStrategy.validatorWithdrawal{value: 1 wei}(testValidators[0].publicKey, 0);
    }

    function test_validatorWithdrawal_RevertWhen_pendingDeposit() public {
        _processValidator(0, 100);
        _activateValidator(0);

        // Top up creates a pending deposit
        _depositToStrategy(5 ether);
        _stakeTopUp(0, 5 ether);

        vm.prank(governor);
        vm.expectRevert("Pending deposit");
        compoundingStakingSSVStrategy.validatorWithdrawal{value: 1 wei}(testValidators[0].publicKey, 0);
    }

    function test_validatorWithdrawal_RevertWhen_notRegistrator() public {
        vm.deal(josh, 1 ether);
        vm.prank(josh);
        vm.expectRevert("Not Registrator");
        compoundingStakingSSVStrategy.validatorWithdrawal{value: 1 wei}(testValidators[0].publicKey, 0);
    }

    function test_validatorWithdrawal_exitAlreadyExiting() public {
        // Process validator to VERIFIED, then activate
        _processValidator(0, 100);
        _activateValidator(0);

        bytes memory publicKey = testValidators[0].publicKey;
        bytes32 pubKeyHash = _hashPubKey(publicKey);

        // First full withdrawal call: ACTIVE (4) → EXITING (5)
        vm.prank(governor);
        vm.expectEmit(true, false, false, true);
        emit ValidatorWithdraw(pubKeyHash, 0);
        compoundingStakingSSVStrategy.validatorWithdrawal{value: 1 wei}(publicKey, 0);

        (CompoundingValidatorManager.ValidatorState state1,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state1), 5, "Should be EXITING after first call");

        // Second full withdrawal call: still EXITING (5)
        vm.prank(governor);
        vm.expectEmit(true, false, false, true);
        emit ValidatorWithdraw(pubKeyHash, 0);
        compoundingStakingSSVStrategy.validatorWithdrawal{value: 1 wei}(publicKey, 0);

        (CompoundingValidatorManager.ValidatorState state2,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state2), 5, "Should remain EXITING after second call");
    }

    function test_validatorWithdrawal_RevertWhen_notActive_onlyVerified() public {
        // Process validator to VERIFIED state (register → stake → verify validator → verify deposit)
        // but do NOT activate it
        _processValidator(0, 100);

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        (CompoundingValidatorManager.ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 3, "Should be VERIFIED");

        vm.prank(governor);
        vm.expectRevert("Validator not active/exiting");
        compoundingStakingSSVStrategy.validatorWithdrawal{value: 1 wei}(testValidators[0].publicKey, 0);
    }

    function test_validatorWithdrawal_partialRevertWhen_notActive() public {
        // Process validator to VERIFIED state but do NOT activate
        _processValidator(0, 100);

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        (CompoundingValidatorManager.ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 3, "Should be VERIFIED");

        vm.prank(governor);
        vm.expectRevert("Validator not active/exiting");
        compoundingStakingSSVStrategy.validatorWithdrawal{value: 1 wei}(
            testValidators[0].publicKey, uint64(1 ether / 1 gwei)
        );
    }

    function test_validatorWithdrawal_RevertWhen_notActive_onlyVerified_withTopUp() public {
        // Process validator through full verification (register → stake → verify validator → verify deposit)
        _processValidator(0, 100);

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        (CompoundingValidatorManager.ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 3, "Should be VERIFIED");

        // Top up with 31 ETH (stake but validator is still VERIFIED, not ACTIVE)
        _depositToStrategy(31 ether);
        _stakeTopUp(0, 31 ether);

        // Verify deposit to clear the pending deposit
        uint256 listLen = compoundingStakingSSVStrategy.depositListLength();
        bytes32 pendingDepositRoot = compoundingStakingSSVStrategy.depositList(listLen - 1);
        _verifyDeposit(pendingDepositRoot);

        // Validator has NOT been activated (no verifyBalances call)
        // Full withdrawal (amount=0) should revert
        vm.prank(governor);
        vm.expectRevert("Validator not active/exiting");
        compoundingStakingSSVStrategy.validatorWithdrawal{value: 1 wei}(testValidators[0].publicKey, 0);
    }

    function test_validatorWithdrawal_partialWithPendingDeposit() public {
        // Process validator 0 fully, then activate it
        _processValidator(0, 100);
        _activateValidator(0);

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        (CompoundingValidatorManager.ValidatorState stateBeforeTopUp,) =
            compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(stateBeforeTopUp), 4, "Should be ACTIVE before top-up");

        // Top up with 5 ETH (stake but don't verify deposit - creates pending deposit)
        _depositToStrategy(5 ether);
        _stakeTopUp(0, 5 ether);

        // Partial withdrawal should succeed even with pending deposit
        vm.prank(governor);
        compoundingStakingSSVStrategy.validatorWithdrawal{value: 1 wei}(
            testValidators[0].publicKey, uint64(5 ether / 1 gwei)
        );

        // State should remain ACTIVE (4)
        (CompoundingValidatorManager.ValidatorState stateAfter,) =
            compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(stateAfter), 4, "Should remain ACTIVE after partial withdrawal");
    }

    // ----------------
    // Helpers
    // ----------------

    function _activateValidator(uint256 index) internal {
        // Advance time past snap delay
        vm.warp(block.timestamp + 500);
        _snapBalances();

        // verifyBalances with 1 verified validator - default balance is 33 ETH (> 32.25)
        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(1), _emptyPendingDepositProofs(0)
        );

        bytes32 pubKeyHash = _hashPubKey(testValidators[index].publicKey);
        (CompoundingValidatorManager.ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 4, "Validator should be ACTIVE");
    }

    function _stakeTopUp(uint256 index, uint256 amount) internal {
        CompoundingValidatorManager.ValidatorStakeData memory stakeData = CompoundingValidatorManager
            .ValidatorStakeData({
                pubkey: testValidators[index].publicKey,
                signature: testValidators[index].signature,
                depositDataRoot: testValidators[index].depositDataRoot
            });

        vm.prank(governor);
        compoundingStakingSSVStrategy.stakeEth(stakeData, uint64(amount / 1 gwei));
    }

    // ----------------
    // Events
    // ----------------

    event ValidatorWithdraw(bytes32 indexed pubKeyHash, uint256 amountWei);
}
