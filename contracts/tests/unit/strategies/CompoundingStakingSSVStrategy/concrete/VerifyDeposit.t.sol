// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";

// --- Project imports
import {
    CompoundingFirstPendingDepositSlotProofData as FirstPendingDepositSlotProofData,
    CompoundingStrategyValidatorProofData as StrategyValidatorProofData
} from "contracts/interfaces/strategies/CompoundingStakingTypes.sol";
import {ICompoundingStakingSSVStrategy} from "contracts/interfaces/strategies/ICompoundingStakingSSVStrategy.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_VerifyDeposit_Test is
    Unit_CompoundingStakingSSVStrategy_Shared_Test
{
    function setUp() public override {
        super.setUp();
        deal(address(mockSsv), address(compoundingStakingSSVStrategy), 1000 ether);
    }

    function test_verifyDeposit() public {
        bytes32 pendingDepositRoot = _registerAndStake(0);
        _verifyValidator(0, 100);

        _verifyDeposit(pendingDepositRoot);

        // Deposit list should be empty after verification
        assertEq(compoundingStakingSSVStrategy.depositListLength(), 0);
    }

    function test_verifyDeposit_RevertWhen_notPending() public {
        bytes32 pendingDepositRoot = _registerAndStake(0);
        _verifyValidator(0, 100);
        _verifyDeposit(pendingDepositRoot);

        // Try to verify again
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

    function test_verifyDeposit_RevertWhen_zeroSlot() public {
        bytes32 pendingDepositRoot = _registerAndStake(0);
        _verifyValidator(0, 100);

        (,, uint64 depositSlot,,) = compoundingStakingSSVStrategy.deposits(pendingDepositRoot);
        uint64 processedSlot = depositSlot + 10_000;

        bytes memory emptyQueueProof = new bytes(1184);

        FirstPendingDepositSlotProofData memory firstPending =
            FirstPendingDepositSlotProofData({slot: 0, proof: emptyQueueProof});

        StrategyValidatorProofData memory strategyValidator =
            StrategyValidatorProofData({withdrawableEpoch: type(uint64).max, withdrawableEpochProof: hex"00"});

        vm.expectRevert("Zero 1st pending deposit slot");
        compoundingStakingSSVStrategy.verifyDeposit(pendingDepositRoot, processedSlot, firstPending, strategyValidator);
    }

    function test_verifyDeposit_RevertWhen_slotNotAfterDeposit() public {
        bytes32 pendingDepositRoot = _registerAndStake(0);
        _verifyValidator(0, 100);

        (,, uint64 depositSlot,,) = compoundingStakingSSVStrategy.deposits(pendingDepositRoot);
        // Use the same slot (not after)
        uint64 processedSlot = depositSlot;

        bytes memory emptyQueueProof = new bytes(1184);

        FirstPendingDepositSlotProofData memory firstPending =
            FirstPendingDepositSlotProofData({slot: 1, proof: emptyQueueProof});

        StrategyValidatorProofData memory strategyValidator =
            StrategyValidatorProofData({withdrawableEpoch: type(uint64).max, withdrawableEpochProof: hex"00"});

        vm.expectRevert("Slot not after deposit");
        compoundingStakingSSVStrategy.verifyDeposit(pendingDepositRoot, processedSlot, firstPending, strategyValidator);
    }

    function test_verifyDeposit_RevertWhen_noDeposit() public {
        // Process a validator so there's valid state
        _processValidator(0, 100);

        // Use a random invalid pending deposit root
        bytes32 invalidRoot = bytes32(uint256(0xdead));

        (,, uint64 depositSlot,,) = compoundingStakingSSVStrategy.deposits(invalidRoot);
        uint64 processedSlot = depositSlot + 10_000;

        bytes memory emptyQueueProof = new bytes(1184);

        FirstPendingDepositSlotProofData memory firstPending =
            FirstPendingDepositSlotProofData({slot: 1, proof: emptyQueueProof});

        StrategyValidatorProofData memory strategyValidator =
            StrategyValidatorProofData({withdrawableEpoch: type(uint64).max, withdrawableEpochProof: hex"00"});

        vm.expectRevert("Deposit not pending");
        compoundingStakingSSVStrategy.verifyDeposit(invalidRoot, processedSlot, firstPending, strategyValidator);
    }

    function test_verifyDeposit_withNoSnappedBalances() public {
        // Register and stake validator
        bytes32 pendingDepositRoot = _registerAndStake(0);
        _verifyValidator(0, 100);

        // Verify deposit WITHOUT calling _snapBalances() first
        // Should succeed because snappedBalance.timestamp == 0 means no snap constraint
        vm.expectEmit(true, false, false, true, address(compoundingStakingSSVStrategy));
        emit ICompoundingStakingSSVStrategy.DepositVerified(pendingDepositRoot, 1 ether);

        _verifyDeposit(pendingDepositRoot);

        // Deposit list should be empty after verification
        assertEq(compoundingStakingSSVStrategy.depositListLength(), 0);
    }

    function test_verifyDeposit_beforeSnapSlot() public {
        // Register and stake validator
        bytes32 pendingDepositRoot = _registerAndStake(0);
        _verifyValidator(0, 100);

        // Get the deposit slot and compute processedSlot used by _verifyDeposit helper
        (,, uint64 depositSlot,,) = compoundingStakingSSVStrategy.deposits(pendingDepositRoot);
        uint64 processedSlot = depositSlot + 10_000;
        // _calcNextBlockTimestamp(processedSlot) = SLOT_DURATION * processedSlot + BEACON_GENESIS_TIMESTAMP + SLOT_DURATION
        // Snap timestamp must be >= _calcNextBlockTimestamp(processedSlot) for the deposit to be "before" the snap
        uint64 requiredSnapTimestamp = _calcNextBlockTimestamp(processedSlot);

        // Advance time so the snap timestamp is just after the processed slot's next block timestamp
        vm.warp(requiredSnapTimestamp + 500);
        _snapBalances();

        vm.expectEmit(true, false, false, true, address(compoundingStakingSSVStrategy));
        emit ICompoundingStakingSSVStrategy.DepositVerified(pendingDepositRoot, 1 ether);

        _verifyDeposit(pendingDepositRoot);

        assertEq(compoundingStakingSSVStrategy.depositListLength(), 0);
    }

    function test_verifyDeposit_wellBeforeSnapSlot() public {
        // Register and stake validator
        bytes32 pendingDepositRoot = _registerAndStake(0);
        _verifyValidator(0, 100);

        // Get the deposit slot and compute processedSlot used by _verifyDeposit helper
        (,, uint64 depositSlot,,) = compoundingStakingSSVStrategy.deposits(pendingDepositRoot);
        uint64 processedSlot = depositSlot + 10_000;
        uint64 requiredSnapTimestamp = _calcNextBlockTimestamp(processedSlot);

        // Advance much more time so the deposit is well before the snap slot
        vm.warp(requiredSnapTimestamp + 5000);
        _snapBalances();

        vm.expectEmit(true, false, false, true, address(compoundingStakingSSVStrategy));
        emit ICompoundingStakingSSVStrategy.DepositVerified(pendingDepositRoot, 1 ether);

        _verifyDeposit(pendingDepositRoot);

        assertEq(compoundingStakingSSVStrategy.depositListLength(), 0);
    }

    function test_verifyDeposit_RevertWhen_depositAfterSnap() public {
        // Register and stake validator
        bytes32 pendingDepositRoot = _registerAndStake(0);
        _verifyValidator(0, 100);

        // Snap balances at current time (before the processedSlot's next block timestamp)
        // The _verifyDeposit helper uses processedSlot = depositSlot + 10_000, which produces
        // a _calcNextBlockTimestamp well after the current block.timestamp, so this will revert.
        _snapBalances();

        // Get deposit data to construct the call manually
        (,, uint64 depositSlot,,) = compoundingStakingSSVStrategy.deposits(pendingDepositRoot);
        uint64 processedSlot = depositSlot + 10_000;

        bytes memory emptyQueueProof = new bytes(1184);

        FirstPendingDepositSlotProofData memory firstPending =
            FirstPendingDepositSlotProofData({slot: 1, proof: emptyQueueProof});

        StrategyValidatorProofData memory strategyValidator =
            StrategyValidatorProofData({withdrawableEpoch: type(uint64).max, withdrawableEpochProof: hex"00"});

        vm.expectRevert("Deposit after balance snapshot");
        compoundingStakingSSVStrategy.verifyDeposit(pendingDepositRoot, processedSlot, firstPending, strategyValidator);
    }
}
