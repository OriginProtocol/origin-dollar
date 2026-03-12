// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CompoundingStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";
import {CompoundingValidatorManager} from "contracts/strategies/NativeStaking/CompoundingValidatorManager.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_StrategyBalances_Test
    is Unit_CompoundingStakingSSVStrategy_Shared_Test
{
    function setUp() public override {
        super.setUp();
        deal(address(mockSsv), address(compoundingStakingSSVStrategy), 1000 ether);
    }

    function test_snapBalances() public {
        vm.warp(block.timestamp + 500);
        uint64 snapTs = _snapBalances();

        (bytes32 blockRoot, uint64 timestamp, uint128 ethBalance) = compoundingStakingSSVStrategy.snappedBalance();
        assertEq(timestamp, snapTs);
        assertEq(uint256(ethBalance), address(compoundingStakingSSVStrategy).balance);
        assertTrue(blockRoot != bytes32(0));
    }

    function test_snapBalances_RevertWhen_tooSoon() public {
        vm.warp(block.timestamp + 500);
        _snapBalances();

        // Try immediately again
        vm.expectRevert("Snap too soon");
        compoundingStakingSSVStrategy.snapBalances();
    }

    function test_verifyBalances_noValidators() public {
        vm.warp(block.timestamp + 500);
        _snapBalances();

        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(0), _emptyPendingDepositProofs(0)
        );

        // lastVerifiedEthBalance should be the snapped ETH balance
        assertEq(compoundingStakingSSVStrategy.lastVerifiedEthBalance(), 0);
    }

    function test_verifyBalances_withWethDeposit() public {
        _depositToStrategy(5 ether);

        vm.warp(block.timestamp + 500);
        _snapBalances();

        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(0), _emptyPendingDepositProofs(0)
        );

        // lastVerifiedEthBalance = 0 (no ETH, only WETH which isn't included in snap)
        // checkBalance = lastVerifiedEthBalance + WETH.balanceOf = 0 + 5 = 5
        assertEq(compoundingStakingSSVStrategy.checkBalance(address(mockWeth)), 5 ether);
    }

    function test_verifyBalances_withValidator() public {
        // Process validator (register, stake 1 ETH, verify validator, verify deposit)
        _processValidator(0, 100);

        // Advance time, snap, verify balances
        vm.warp(block.timestamp + 500);
        _snapBalances();

        // MockBeaconProofs returns 33 ETH (DEFAULT_VALIDATOR_BALANCE_GWEI) for the validator
        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(1), _emptyPendingDepositProofs(0)
        );

        // Validator balance should be 33 ETH (mock default)
        uint256 expectedVerifiedBalance = 33 ether + address(compoundingStakingSSVStrategy).balance;
        assertEq(compoundingStakingSSVStrategy.lastVerifiedEthBalance(), expectedVerifiedBalance);
    }

    function test_verifyBalances_withPendingDeposit() public {
        // Register, stake, verify validator but don't verify deposit
        _registerAndStake(0);
        _verifyValidator(0, 100);

        // Advance time, snap, verify balances
        vm.warp(block.timestamp + 500);
        _snapBalances();

        // 1 verified validator + 1 pending deposit
        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(1), _emptyPendingDepositProofs(1)
        );

        // lastVerifiedEthBalance = pendingDeposit(1 ETH) + validatorBalance(33 ETH) + snapEthBalance
        uint256 expected = 1 ether + 33 ether + address(compoundingStakingSSVStrategy).balance;
        assertEq(compoundingStakingSSVStrategy.lastVerifiedEthBalance(), expected);
    }

    function test_verifyBalances_RevertWhen_noSnap() public {
        vm.expectRevert("No snapped balances");
        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(0), _emptyPendingDepositProofs(0)
        );
    }

    function test_verifyBalances_resetsSnapTimestamp() public {
        vm.warp(block.timestamp + 500);
        _snapBalances();

        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(0), _emptyPendingDepositProofs(0)
        );

        // Snap timestamp should be reset to 0
        (, uint64 timestamp,) = compoundingStakingSSVStrategy.snappedBalance();
        assertEq(timestamp, 0);
    }

    function test_depositListLength() public {
        assertEq(compoundingStakingSSVStrategy.depositListLength(), 0);

        _registerAndStake(0);
        assertEq(compoundingStakingSSVStrategy.depositListLength(), 1);
    }

    function test_verifiedValidatorsLength() public {
        assertEq(compoundingStakingSSVStrategy.verifiedValidatorsLength(), 0);

        _processValidator(0, 100);
        assertEq(compoundingStakingSSVStrategy.verifiedValidatorsLength(), 1);
    }

    //////////////////////////////////////////////////////
    /// --- NO DEPOSITS / VALIDATORS GROUP
    //////////////////////////////////////////////////////

    function test_verifyBalances_noWeth() public {
        // Snap balances, then verify with empty proofs
        vm.warp(block.timestamp + 500);
        uint64 snapTs = _snapBalances();

        vm.expectEmit(true, false, false, true);
        emit CompoundingValidatorManager.BalancesVerified(snapTs, 0, 0, 0);

        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(0), _emptyPendingDepositProofs(0)
        );

        assertEq(compoundingStakingSSVStrategy.lastVerifiedEthBalance(), 0);
        assertEq(compoundingStakingSSVStrategy.checkBalance(address(mockWeth)), 0);
    }

    function test_verifyBalances_wethBeforeSnap() public {
        // Deposit WETH to strategy before snapping
        _depositToStrategy(1.23 ether);

        vm.warp(block.timestamp + 500);
        _snapBalances();

        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(0), _emptyPendingDepositProofs(0)
        );

        assertEq(compoundingStakingSSVStrategy.lastVerifiedEthBalance(), 0);
        assertEq(compoundingStakingSSVStrategy.checkBalance(address(mockWeth)), 1.23 ether);
    }

    function test_verifyBalances_wethAfterSnap() public {
        // Snap first, then transfer WETH directly
        vm.warp(block.timestamp + 500);
        _snapBalances();

        vm.prank(josh);
        weth.transfer(address(compoundingStakingSSVStrategy), 5.67 ether);

        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(0), _emptyPendingDepositProofs(0)
        );

        assertEq(compoundingStakingSSVStrategy.lastVerifiedEthBalance(), 0);
        assertEq(compoundingStakingSSVStrategy.checkBalance(address(mockWeth)), 5.67 ether);
    }

    function test_verifyBalances_wethBeforeAndAfterSnap() public {
        // Deposit 1.23 ether before snap
        _depositToStrategy(1.23 ether);

        vm.warp(block.timestamp + 500);
        _snapBalances();

        // Transfer 5.67 ether directly after snap
        vm.prank(josh);
        weth.transfer(address(compoundingStakingSSVStrategy), 5.67 ether);

        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(0), _emptyPendingDepositProofs(0)
        );

        assertEq(compoundingStakingSSVStrategy.checkBalance(address(mockWeth)), 6.9 ether);
    }

    function test_verifyBalances_withRegisteredValidator() public {
        // Register validator 0 (don't stake), deposit 10 ether
        _registerValidator(0);
        _depositToStrategy(10 ether);

        vm.warp(block.timestamp + 500);
        _snapBalances();

        // 0 validators in balance proofs (not staked, so not verified)
        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(0), _emptyPendingDepositProofs(0)
        );

        assertEq(compoundingStakingSSVStrategy.lastVerifiedEthBalance(), 0);
        assertEq(compoundingStakingSSVStrategy.checkBalance(address(mockWeth)), 10 ether);
    }

    function test_verifyBalances_withStakedValidator() public {
        // Register and stake validator 0 (1 ETH staked, deposit is pending)
        _registerAndStake(0);

        // Validator is STAKED but not verified on beacon chain yet.
        // However, the deposit is in depositList (1 pending deposit).
        // verifyBalances with 0 active validators but 1 pending deposit.
        vm.warp(block.timestamp + 500);
        _snapBalances();

        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(0), _emptyPendingDepositProofs(1)
        );

        // totalDepositsWei = 1 ether (from pending deposit)
        // totalValidatorBalance = 0 (no verified validators)
        // ethBalance = snapped ETH balance (0, ETH was sent to deposit contract)
        assertEq(compoundingStakingSSVStrategy.lastVerifiedEthBalance(), 1 ether);
        assertEq(compoundingStakingSSVStrategy.checkBalance(address(mockWeth)), 1 ether);
    }

    function test_verifyBalances_withVerifiedDeposit() public {
        // Process validator 0 fully (register, stake, verify validator, verify deposit)
        _processValidator(0, 100);

        // Now deposit is VERIFIED and removed from depositList.
        // Validator is in verifiedValidators list.
        vm.warp(block.timestamp + 500);
        _snapBalances();

        // 1 validator balance proof, 0 pending deposits
        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(1), _emptyPendingDepositProofs(0)
        );

        // MockBeaconProofs returns default 33 ETH for the validator
        uint256 ethBal = address(compoundingStakingSSVStrategy).balance;
        assertEq(compoundingStakingSSVStrategy.lastVerifiedEthBalance(), 33 ether + ethBal);
    }

    //////////////////////////////////////////////////////
    /// --- PROOF VALIDATION GROUP
    //////////////////////////////////////////////////////

    function test_verifyBalances_RevertWhen_notEnoughValidatorLeaves() public {
        // Process 2 validators -> 2 verified validators
        _processValidator(0, 100);
        _processValidator(1, 101);

        vm.warp(block.timestamp + 500);
        _snapBalances();

        // Pass only 1 leaf but 2 verified validators exist
        CompoundingValidatorManager.BalanceProofs memory badProofs = CompoundingValidatorManager.BalanceProofs({
            balancesContainerRoot: bytes32(0),
            balancesContainerProof: hex"00",
            validatorBalanceLeaves: new bytes32[](1),
            validatorBalanceProofs: new bytes[](2)
        });
        badProofs.validatorBalanceLeaves[0] = bytes32(0);
        badProofs.validatorBalanceProofs[0] = hex"00";
        badProofs.validatorBalanceProofs[1] = hex"00";

        vm.expectRevert("Invalid balance leaves");
        compoundingStakingSSVStrategy.verifyBalances(badProofs, _emptyPendingDepositProofs(0));
    }

    function test_verifyBalances_RevertWhen_tooManyValidatorLeaves() public {
        // Process 1 validator -> 1 verified validator
        _processValidator(0, 100);

        vm.warp(block.timestamp + 500);
        _snapBalances();

        // Pass 2 leaves but only 1 verified validator exists
        CompoundingValidatorManager.BalanceProofs memory badProofs = CompoundingValidatorManager.BalanceProofs({
            balancesContainerRoot: bytes32(0),
            balancesContainerProof: hex"00",
            validatorBalanceLeaves: new bytes32[](2),
            validatorBalanceProofs: new bytes[](1)
        });
        badProofs.validatorBalanceLeaves[0] = bytes32(0);
        badProofs.validatorBalanceLeaves[1] = bytes32(0);
        badProofs.validatorBalanceProofs[0] = hex"00";

        vm.expectRevert("Invalid balance leaves");
        compoundingStakingSSVStrategy.verifyBalances(badProofs, _emptyPendingDepositProofs(0));
    }

    function test_verifyBalances_RevertWhen_notEnoughValidatorProofs() public {
        // Process 2 validators -> 2 verified validators
        _processValidator(0, 100);
        _processValidator(1, 101);

        vm.warp(block.timestamp + 500);
        _snapBalances();

        // Pass 2 leaves but only 1 proof
        CompoundingValidatorManager.BalanceProofs memory badProofs = CompoundingValidatorManager.BalanceProofs({
            balancesContainerRoot: bytes32(0),
            balancesContainerProof: hex"00",
            validatorBalanceLeaves: new bytes32[](2),
            validatorBalanceProofs: new bytes[](1)
        });
        badProofs.validatorBalanceLeaves[0] = bytes32(0);
        badProofs.validatorBalanceLeaves[1] = bytes32(0);
        badProofs.validatorBalanceProofs[0] = hex"00";

        vm.expectRevert("Invalid balance proofs");
        compoundingStakingSSVStrategy.verifyBalances(badProofs, _emptyPendingDepositProofs(0));
    }

    function test_verifyBalances_RevertWhen_tooManyValidatorProofs() public {
        // Process 1 validator -> 1 verified validator
        _processValidator(0, 100);

        vm.warp(block.timestamp + 500);
        _snapBalances();

        // Pass 1 leaf but 2 proofs
        CompoundingValidatorManager.BalanceProofs memory badProofs = CompoundingValidatorManager.BalanceProofs({
            balancesContainerRoot: bytes32(0),
            balancesContainerProof: hex"00",
            validatorBalanceLeaves: new bytes32[](1),
            validatorBalanceProofs: new bytes[](2)
        });
        badProofs.validatorBalanceLeaves[0] = bytes32(0);
        badProofs.validatorBalanceProofs[0] = hex"00";
        badProofs.validatorBalanceProofs[1] = hex"00";

        vm.expectRevert("Invalid balance proofs");
        compoundingStakingSSVStrategy.verifyBalances(badProofs, _emptyPendingDepositProofs(0));
    }

    //////////////////////////////////////////////////////
    /// --- VALIDATOR ACTIVATION THRESHOLD TESTS
    //////////////////////////////////////////////////////

    function test_verifyBalances_validatorNotActivatedAt32_25() public {
        // Process validator 0 fully
        _processValidator(0, 100);

        // Set validator balance to exactly 32.25 ETH in Gwei (activation threshold, not exceeded)
        mockBeaconProofs.setValidatorBalance(uint40(100), uint256(32.25 ether / 1e9));

        vm.warp(block.timestamp + 500);
        _snapBalances();

        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(1), _emptyPendingDepositProofs(0)
        );

        // Validator state should remain VERIFIED (not activated since balance <= threshold)
        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        (CompoundingValidatorManager.ValidatorState state,) =
            compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint256(state), uint256(CompoundingValidatorManager.ValidatorState.VERIFIED));
    }

    function test_verifyBalances_validatorActivatedAbove32_25() public {
        // Process validator 0 fully
        _processValidator(0, 100);

        // Set validator balance to 32.26 ETH in Gwei (above activation threshold)
        mockBeaconProofs.setValidatorBalance(uint40(100), uint256(32.26 ether / 1e9));

        vm.warp(block.timestamp + 500);
        _snapBalances();

        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(1), _emptyPendingDepositProofs(0)
        );

        // Validator state should be ACTIVE (balance > 32.25 ETH threshold)
        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        (CompoundingValidatorManager.ValidatorState state,) =
            compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint256(state), uint256(CompoundingValidatorManager.ValidatorState.ACTIVE));
    }

    //////////////////////////////////////////////////////
    /// --- FULL WITHDRAWAL TEST
    //////////////////////////////////////////////////////

    function test_verifyBalances_fullWithdrawalExitsValidator() public {
        // Process validator 0 fully and activate it
        _processValidator(0, 100);

        // First activate the validator by setting balance above threshold
        mockBeaconProofs.setValidatorBalance(uint40(100), uint256(33 ether / 1e9));
        vm.warp(block.timestamp + 500);
        _snapBalances();
        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(1), _emptyPendingDepositProofs(0)
        );

        // Confirm validator is now ACTIVE
        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        (CompoundingValidatorManager.ValidatorState stateBeforeExit,) =
            compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint256(stateBeforeExit), uint256(CompoundingValidatorManager.ValidatorState.ACTIVE));

        // Set validator balance to 0 (type(uint256).max is the special "zero" value in mock)
        mockBeaconProofs.setValidatorBalance(uint40(100), type(uint256).max);

        vm.warp(block.timestamp + 500);
        _snapBalances();

        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(1), _emptyPendingDepositProofs(0)
        );

        // Validator state should be EXITED
        (CompoundingValidatorManager.ValidatorState stateAfterExit,) =
            compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint256(stateAfterExit), uint256(CompoundingValidatorManager.ValidatorState.EXITED));

        // Verified validators list should be empty
        assertEq(compoundingStakingSSVStrategy.verifiedValidatorsLength(), 0);
    }

    //////////////////////////////////////////////////////
    /// --- WITHDRAWAL ACCOUNTING TESTS
    //////////////////////////////////////////////////////

    /// @dev Helper to activate a processed validator (set balance > 32.25 ETH, snap, verify)
    function _activateValidator(uint256 validatorCount) internal {
        vm.warp(block.timestamp + 500);
        _snapBalances();
        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(validatorCount), _emptyPendingDepositProofs(0)
        );

        // Assert validator 0 is now ACTIVE
        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        (CompoundingValidatorManager.ValidatorState state,) =
            compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint256(state), uint256(CompoundingValidatorManager.ValidatorState.ACTIVE));
    }

    /// @dev Helper to top up a validator with additional ETH
    function _topUp(uint256 index, uint256 amount) internal {
        _depositToStrategy(amount);

        CompoundingValidatorManager.ValidatorStakeData memory stakeData = CompoundingValidatorManager
            .ValidatorStakeData({
                pubkey: testValidators[index].publicKey,
                signature: testValidators[index].signature,
                depositDataRoot: testValidators[index].depositDataRoot
            });

        vm.prank(governor);
        compoundingStakingSSVStrategy.stakeEth(stakeData, uint64(amount / 1 gwei));
    }

    function test_verifyBalances_partialWithdrawal() public {
        // Process validator 0 fully + activate it
        _processValidator(0, 100);
        _activateValidator(1);

        // Record lastVerifiedEthBalance before partial withdrawal
        uint256 balanceBefore = compoundingStakingSSVStrategy.lastVerifiedEthBalance();

        // Do partial withdrawal of 5 ETH
        vm.deal(governor, 1 wei);
        vm.prank(governor);
        compoundingStakingSSVStrategy.validatorWithdrawal{value: 1 wei}(
            testValidators[0].publicKey, uint64(5 ether / 1 gwei)
        );

        // Set validator balance to (33 - 5) = 28 ETH in Gwei
        mockBeaconProofs.setValidatorBalance(uint40(100), uint256(28 ether / 1e9));

        // Simulate the 5 ETH withdrawal arriving at the strategy
        vm.deal(address(compoundingStakingSSVStrategy), address(compoundingStakingSSVStrategy).balance + 5 ether);

        // Advance time, snap, verifyBalances
        vm.warp(block.timestamp + 500);
        _snapBalances();
        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(1), _emptyPendingDepositProofs(0)
        );

        // Verify validator state remains ACTIVE
        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        (CompoundingValidatorManager.ValidatorState state,) =
            compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint256(state), uint256(CompoundingValidatorManager.ValidatorState.ACTIVE));

        // Verify lastVerifiedEthBalance reflects the new balance
        // 28 ETH (validator) + strategy ETH balance (includes the 5 ETH withdrawal)
        uint256 expectedBalance = 28 ether + address(compoundingStakingSSVStrategy).balance;
        assertEq(compoundingStakingSSVStrategy.lastVerifiedEthBalance(), expectedBalance);
    }

    function test_verifyBalances_fullWithdrawalAccounting() public {
        // Process validator 0 fully + activate it
        _processValidator(0, 100);
        _activateValidator(1);

        // Record lastVerifiedEthBalance and verifiedValidatorsLength
        uint256 balanceBefore = compoundingStakingSSVStrategy.lastVerifiedEthBalance();
        uint256 validatorsLenBefore = compoundingStakingSSVStrategy.verifiedValidatorsLength();

        // Do full withdrawal (amountGwei = 0) → state becomes EXITING
        vm.deal(governor, 1 wei);
        vm.prank(governor);
        compoundingStakingSSVStrategy.validatorWithdrawal{value: 1 wei}(
            testValidators[0].publicKey, 0
        );

        // Confirm state is EXITING
        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        (CompoundingValidatorManager.ValidatorState exitingState,) =
            compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint256(exitingState), uint256(CompoundingValidatorManager.ValidatorState.EXITING));

        // Set validator balance to 0 (type(uint256).max is the sentinel for zero in mock)
        mockBeaconProofs.setValidatorBalance(uint40(100), type(uint256).max);

        // Simulate the 33 ETH withdrawal arriving at the strategy
        vm.deal(address(compoundingStakingSSVStrategy), address(compoundingStakingSSVStrategy).balance + 33 ether);

        // Advance time, snap, verifyBalances
        vm.warp(block.timestamp + 500);
        _snapBalances();
        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(1), _emptyPendingDepositProofs(0)
        );

        // Verify validator state is EXITED
        (CompoundingValidatorManager.ValidatorState exitedState,) =
            compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint256(exitedState), uint256(CompoundingValidatorManager.ValidatorState.EXITED));

        // Verify verifiedValidatorsLength == 0
        assertEq(compoundingStakingSSVStrategy.verifiedValidatorsLength(), 0);
    }

    function test_verifyBalances_twoDepositsToExitingValidator() public {
        // Process validator 0 fully + activate it
        _processValidator(0, 100);
        _activateValidator(1);

        // Top up with 5 ETH (creates pending deposit, but don't verify deposit)
        _topUp(0, 5 ether);
        assertEq(compoundingStakingSSVStrategy.depositListLength(), 1);

        // Top up with 3 ETH (creates another pending deposit)
        _topUp(0, 3 ether);
        assertEq(compoundingStakingSSVStrategy.depositListLength(), 2);

        // Set validator balance to 0 (type(uint256).max sentinel) to simulate exit
        mockBeaconProofs.setValidatorBalance(uint40(100), type(uint256).max);

        // Advance time, snap, verifyBalances with 1 validator + 2 pending deposits
        vm.warp(block.timestamp + 500);
        _snapBalances();
        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(1), _emptyPendingDepositProofs(2)
        );

        // Validator has pending deposits, so it cannot be removed from verifiedValidators.
        // The contract keeps the validator in the list to avoid under-counting once the
        // beacon chain processes the pending deposits and the validator balance increases.
        assertEq(compoundingStakingSSVStrategy.verifiedValidatorsLength(), 1);

        // Deposits remain pending (not removed by verifyBalances)
        assertEq(compoundingStakingSSVStrategy.depositListLength(), 2);

        // Validator state should still be ACTIVE (not EXITED) because deposits are pending
        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        (CompoundingValidatorManager.ValidatorState state,) =
            compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint256(state), uint256(CompoundingValidatorManager.ValidatorState.ACTIVE));
    }

    //////////////////////////////////////////////////////
    /// --- DEPOSIT VERIFICATION ORDERING TESTS
    //////////////////////////////////////////////////////

    function test_verifyDeposit_RevertWhen_depositAfterSnap_duringSnapCycle() public {
        // Register, stake, verify validator for validator 0
        bytes32 pendingDepositRoot = _registerAndStake(0);
        _verifyValidator(0, 100);

        // Snap balances
        vm.warp(block.timestamp + 500);
        _snapBalances();

        // Get the pending deposit data to construct the processedSlot
        (,, uint64 depositSlot,,) = compoundingStakingSSVStrategy.deposits(pendingDepositRoot);
        // Use a processedSlot that is AFTER the snap timestamp
        // The snap was at block.timestamp, so use a slot that maps to after the snap
        uint64 processedSlot = _calcSlot(block.timestamp) + 100;

        // Empty deposit queue proof (37 * 32 = 1184 bytes)
        bytes memory emptyQueueProof = new bytes(1184);

        CompoundingValidatorManager.FirstPendingDepositSlotProofData memory firstPending =
            CompoundingValidatorManager.FirstPendingDepositSlotProofData({slot: 1, proof: emptyQueueProof});

        CompoundingValidatorManager.StrategyValidatorProofData memory strategyValidator =
            CompoundingValidatorManager.StrategyValidatorProofData({
                withdrawableEpoch: type(uint64).max,
                withdrawableEpochProof: hex"00"
            });

        // Should revert with "Deposit after balance snapshot"
        vm.expectRevert("Deposit after balance snapshot");
        compoundingStakingSSVStrategy.verifyDeposit(
            pendingDepositRoot, processedSlot, firstPending, strategyValidator
        );
    }
}
