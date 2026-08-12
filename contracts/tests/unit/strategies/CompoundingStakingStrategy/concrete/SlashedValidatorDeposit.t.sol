// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingStrategy/shared/Shared.t.sol";

// --- Project imports
import {
    CompoundingFirstPendingDepositSlotProofData as FirstPendingDepositSlotProofData,
    CompoundingStrategyValidatorProofData as StrategyValidatorProofData,
    CompoundingValidatorStakeData as ValidatorStakeData
} from "contracts/interfaces/strategies/CompoundingStakingTypes.sol";
import {ICompoundingStakingStrategy} from "contracts/interfaces/strategies/ICompoundingStakingStrategy.sol";

contract Unit_Concrete_CompoundingStakingStrategy_SlashedValidatorDeposit_Test is
    Unit_CompoundingStakingStrategy_Shared_Test
{
    bytes32 internal pendingDepositRoot;
    uint64 internal withdrawableEpoch;
    uint64 internal withdrawableSlot;

    event DepositVerified(bytes32 indexed pendingDepositRoot, uint256 amountWei);

    function setUp() public override {
        super.setUp();

        // Process validator 3 through full flow: stake 1 ETH, verify validator, verify deposit
        _processValidator(3, 100);

        // Top up with additional ETH and stake to create a new pending deposit
        _depositToStrategy(3 ether);

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[3].publicKey,
            signature: testValidators[3].signature,
            depositDataRoot: testValidators[3].depositDataRoot
        });

        vm.prank(governor);
        compoundingStakingStrategy.stakeEth(stakeData, uint64(3 ether / 1 gwei));

        // Get the pending deposit info
        pendingDepositRoot = compoundingStakingStrategy.depositList(compoundingStakingStrategy.depositListLength() - 1);

        // Calculate withdrawable epoch and slot
        withdrawableEpoch = uint64((block.timestamp - BEACON_GENESIS_TIMESTAMP) / (SLOT_DURATION * SLOTS_PER_EPOCH)) + 4;
        withdrawableSlot = withdrawableEpoch * SLOTS_PER_EPOCH;
    }

    /// @dev Reverts when first pending deposit slot is before the withdrawable epoch's first slot
    function test_verifyDeposit_RevertWhen_firstPendingDepositBeforeWithdrawableEpoch() public {
        // Non-empty queue proof (40 * 32 = 1280 bytes)
        bytes memory nonEmptyQueueProof = new bytes(1280);

        FirstPendingDepositSlotProofData memory firstPending =
            FirstPendingDepositSlotProofData({slot: withdrawableSlot - 1, proof: nonEmptyQueueProof});

        StrategyValidatorProofData memory strategyValidator =
            StrategyValidatorProofData({withdrawableEpoch: withdrawableEpoch, withdrawableEpochProof: hex"00"});

        vm.expectRevert("Exit Deposit likely not proc.");
        compoundingStakingStrategy.verifyDeposit(pendingDepositRoot, withdrawableSlot, firstPending, strategyValidator);
    }

    /// @dev Empty queue proof bypasses the withdrawable epoch check
    function test_verifyDeposit_emptyQueueAllowsDeposit() public {
        // Empty deposit queue proof (37 * 32 = 1184 bytes)
        bytes memory emptyQueueProof = new bytes(1184);

        FirstPendingDepositSlotProofData memory firstPending =
            FirstPendingDepositSlotProofData({slot: 1, proof: emptyQueueProof});

        StrategyValidatorProofData memory strategyValidator =
            StrategyValidatorProofData({withdrawableEpoch: withdrawableEpoch, withdrawableEpochProof: hex"00"});

        vm.expectEmit(true, false, false, true, address(compoundingStakingStrategy));
        emit ICompoundingStakingStrategy.DepositVerified(pendingDepositRoot, 3 ether);

        compoundingStakingStrategy.verifyDeposit(pendingDepositRoot, withdrawableSlot, firstPending, strategyValidator);
    }

    /// @dev First pending deposit at exactly the withdrawable epoch's first slot passes (condition is <, not <=)
    function test_verifyDeposit_firstPendingDepositAtWithdrawableEpoch() public {
        // Non-empty queue proof (40 * 32 = 1280 bytes)
        bytes memory nonEmptyQueueProof = new bytes(1280);

        FirstPendingDepositSlotProofData memory firstPending =
            FirstPendingDepositSlotProofData({slot: withdrawableSlot, proof: nonEmptyQueueProof});

        StrategyValidatorProofData memory strategyValidator =
            StrategyValidatorProofData({withdrawableEpoch: withdrawableEpoch, withdrawableEpochProof: hex"00"});

        vm.expectEmit(true, false, false, true, address(compoundingStakingStrategy));
        emit ICompoundingStakingStrategy.DepositVerified(pendingDepositRoot, 3 ether);

        compoundingStakingStrategy.verifyDeposit(pendingDepositRoot, withdrawableSlot, firstPending, strategyValidator);
    }

    /// @dev First pending deposit after the withdrawable epoch's first slot passes
    function test_verifyDeposit_firstPendingDepositAfterWithdrawableEpoch() public {
        // Non-empty queue proof (40 * 32 = 1280 bytes)
        bytes memory nonEmptyQueueProof = new bytes(1280);

        FirstPendingDepositSlotProofData memory firstPending =
            FirstPendingDepositSlotProofData({slot: withdrawableSlot + 1, proof: nonEmptyQueueProof});

        StrategyValidatorProofData memory strategyValidator =
            StrategyValidatorProofData({withdrawableEpoch: withdrawableEpoch, withdrawableEpochProof: hex"00"});

        vm.expectEmit(true, false, false, true, address(compoundingStakingStrategy));
        emit ICompoundingStakingStrategy.DepositVerified(pendingDepositRoot, 3 ether);

        compoundingStakingStrategy.verifyDeposit(
            pendingDepositRoot, withdrawableSlot + 6, firstPending, strategyValidator
        );
    }
}
