// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_CompoundingStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";
import {CompoundingValidatorManager} from "contracts/strategies/NativeStaking/CompoundingValidatorManager.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_SlashedValidatorDeposit_Test is
    Unit_CompoundingStakingSSVStrategy_Shared_Test
{
    bytes32 internal pendingDepositRoot;
    uint64 internal withdrawableEpoch;
    uint64 internal withdrawableSlot;

    event DepositVerified(bytes32 indexed pendingDepositRoot, uint256 amountWei);

    function setUp() public override {
        super.setUp();
        deal(address(mockSsv), address(compoundingStakingSSVStrategy), 1000 ether);

        // Process validator 3 through full flow: register, stake 1 ETH, verify validator, verify deposit
        _processValidator(3, 100);

        // Top up with additional ETH and stake to create a new pending deposit
        _depositToStrategy(3 ether);

        CompoundingValidatorManager.ValidatorStakeData memory stakeData = CompoundingValidatorManager.ValidatorStakeData({
            pubkey: testValidators[3].publicKey,
            signature: testValidators[3].signature,
            depositDataRoot: testValidators[3].depositDataRoot
        });

        vm.prank(governor);
        compoundingStakingSSVStrategy.stakeEth(stakeData, uint64(3 ether / 1 gwei));

        // Get the pending deposit info
        pendingDepositRoot =
            compoundingStakingSSVStrategy.depositList(compoundingStakingSSVStrategy.depositListLength() - 1);

        // Calculate withdrawable epoch and slot
        withdrawableEpoch = uint64((block.timestamp - BEACON_GENESIS_TIMESTAMP) / (SLOT_DURATION * SLOTS_PER_EPOCH)) + 4;
        withdrawableSlot = withdrawableEpoch * SLOTS_PER_EPOCH;
    }

    /// @dev Reverts when first pending deposit slot is before the withdrawable epoch's first slot
    function test_verifyDeposit_RevertWhen_firstPendingDepositBeforeWithdrawableEpoch() public {
        // Non-empty queue proof (40 * 32 = 1280 bytes)
        bytes memory nonEmptyQueueProof = new bytes(1280);

        CompoundingValidatorManager.FirstPendingDepositSlotProofData memory firstPending =
            CompoundingValidatorManager.FirstPendingDepositSlotProofData({
                slot: withdrawableSlot - 1, proof: nonEmptyQueueProof
            });

        CompoundingValidatorManager.StrategyValidatorProofData memory strategyValidator =
            CompoundingValidatorManager.StrategyValidatorProofData({
                withdrawableEpoch: withdrawableEpoch, withdrawableEpochProof: hex"00"
            });

        vm.expectRevert("Exit Deposit likely not proc.");
        compoundingStakingSSVStrategy.verifyDeposit(
            pendingDepositRoot, withdrawableSlot, firstPending, strategyValidator
        );
    }

    /// @dev Empty queue proof bypasses the withdrawable epoch check
    function test_verifyDeposit_emptyQueueAllowsDeposit() public {
        // Empty deposit queue proof (37 * 32 = 1184 bytes)
        bytes memory emptyQueueProof = new bytes(1184);

        CompoundingValidatorManager.FirstPendingDepositSlotProofData memory firstPending =
            CompoundingValidatorManager.FirstPendingDepositSlotProofData({slot: 1, proof: emptyQueueProof});

        CompoundingValidatorManager.StrategyValidatorProofData memory strategyValidator =
            CompoundingValidatorManager.StrategyValidatorProofData({
                withdrawableEpoch: withdrawableEpoch, withdrawableEpochProof: hex"00"
            });

        vm.expectEmit(true, false, false, true, address(compoundingStakingSSVStrategy));
        emit DepositVerified(pendingDepositRoot, 3 ether);

        compoundingStakingSSVStrategy.verifyDeposit(
            pendingDepositRoot, withdrawableSlot, firstPending, strategyValidator
        );
    }

    /// @dev First pending deposit at exactly the withdrawable epoch's first slot passes (condition is <, not <=)
    function test_verifyDeposit_firstPendingDepositAtWithdrawableEpoch() public {
        // Non-empty queue proof (40 * 32 = 1280 bytes)
        bytes memory nonEmptyQueueProof = new bytes(1280);

        CompoundingValidatorManager.FirstPendingDepositSlotProofData memory firstPending =
            CompoundingValidatorManager.FirstPendingDepositSlotProofData({
                slot: withdrawableSlot, proof: nonEmptyQueueProof
            });

        CompoundingValidatorManager.StrategyValidatorProofData memory strategyValidator =
            CompoundingValidatorManager.StrategyValidatorProofData({
                withdrawableEpoch: withdrawableEpoch, withdrawableEpochProof: hex"00"
            });

        vm.expectEmit(true, false, false, true, address(compoundingStakingSSVStrategy));
        emit DepositVerified(pendingDepositRoot, 3 ether);

        compoundingStakingSSVStrategy.verifyDeposit(
            pendingDepositRoot, withdrawableSlot, firstPending, strategyValidator
        );
    }

    /// @dev First pending deposit after the withdrawable epoch's first slot passes
    function test_verifyDeposit_firstPendingDepositAfterWithdrawableEpoch() public {
        // Non-empty queue proof (40 * 32 = 1280 bytes)
        bytes memory nonEmptyQueueProof = new bytes(1280);

        CompoundingValidatorManager.FirstPendingDepositSlotProofData memory firstPending =
            CompoundingValidatorManager.FirstPendingDepositSlotProofData({
                slot: withdrawableSlot + 1, proof: nonEmptyQueueProof
            });

        CompoundingValidatorManager.StrategyValidatorProofData memory strategyValidator =
            CompoundingValidatorManager.StrategyValidatorProofData({
                withdrawableEpoch: withdrawableEpoch, withdrawableEpochProof: hex"00"
            });

        vm.expectEmit(true, false, false, true, address(compoundingStakingSSVStrategy));
        emit DepositVerified(pendingDepositRoot, 3 ether);

        compoundingStakingSSVStrategy.verifyDeposit(
            pendingDepositRoot, withdrawableSlot + 6, firstPending, strategyValidator
        );
    }
}
