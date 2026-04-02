// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_CompoundingStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";
import {
    CompoundingBalanceProofs as BalanceProofs,
    CompoundingFirstPendingDepositSlotProofData as FirstPendingDepositSlotProofData,
    CompoundingPendingDepositProofs as PendingDepositProofs,
    CompoundingStrategyValidatorProofData as StrategyValidatorProofData,
    CompoundingValidatorStakeData as ValidatorStakeData,
    CompoundingValidatorState as ValidatorState
} from "contracts/interfaces/strategies/CompoundingStakingTypes.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_ValidatorStaking_Test is
    Unit_CompoundingStakingSSVStrategy_Shared_Test
{
    function setUp() public override {
        super.setUp();
        // Fund strategy with SSV tokens
        deal(address(mockSsv), address(compoundingStakingSSVStrategy), 1000 ether);
    }

    function test_stakeEth_firstDeposit() public {
        _registerValidator(0);
        _depositToStrategy(1 ether);

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(governor);
        compoundingStakingSSVStrategy.stakeEth(stakeData, uint64(1 ether / 1 gwei));

        // State should be STAKED (2)
        (ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 2);

        // firstDeposit should be true
        assertTrue(compoundingStakingSSVStrategy.firstDeposit());

        // Should have 1 pending deposit
        assertEq(compoundingStakingSSVStrategy.depositListLength(), 1);
    }

    function test_stakeEth_RevertWhen_notExactly1Eth() public {
        _registerValidator(0);
        _depositToStrategy(2 ether);

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(governor);
        vm.expectRevert("Invalid first deposit amount");
        compoundingStakingSSVStrategy.stakeEth(stakeData, uint64(2 ether / 1 gwei));
    }

    function test_stakeEth_RevertWhen_existingFirstDeposit() public {
        // First validator first deposit
        _registerAndStake(0);
        assertTrue(compoundingStakingSSVStrategy.firstDeposit());

        // Second validator should fail
        _registerValidator(1);
        _depositToStrategy(1 ether);

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[1].publicKey,
            signature: testValidators[1].signature,
            depositDataRoot: testValidators[1].depositDataRoot
        });

        vm.prank(governor);
        vm.expectRevert("Existing first deposit");
        compoundingStakingSSVStrategy.stakeEth(stakeData, uint64(1 ether / 1 gwei));
    }

    function test_stakeEth_RevertWhen_notRegistered() public {
        _depositToStrategy(1 ether);

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(governor);
        vm.expectRevert("Not registered or verified");
        compoundingStakingSSVStrategy.stakeEth(stakeData, uint64(1 ether / 1 gwei));
    }

    function test_stakeEth_RevertWhen_insufficientWeth() public {
        _registerValidator(0);
        // Don't deposit WETH

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(governor);
        vm.expectRevert("Insufficient WETH");
        compoundingStakingSSVStrategy.stakeEth(stakeData, uint64(1 ether / 1 gwei));
    }

    function test_stakeEth_RevertWhen_paused() public {
        _registerValidator(0);
        _depositToStrategy(1 ether);

        vm.prank(governor);
        compoundingStakingSSVStrategy.pause();

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(governor);
        vm.expectRevert("Pausable: paused");
        compoundingStakingSSVStrategy.stakeEth(stakeData, uint64(1 ether / 1 gwei));
    }

    function test_stakeEth_RevertWhen_notRegistrator() public {
        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(josh);
        vm.expectRevert("Not Registrator");
        compoundingStakingSSVStrategy.stakeEth(stakeData, uint64(1 ether / 1 gwei));
    }

    function test_stakeEth_topUpVerifiedValidator() public {
        // Process validator through verification
        _processValidator(0, 100);

        // Top up with 31 ETH
        _depositToStrategy(31 ether);

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(governor);
        compoundingStakingSSVStrategy.stakeEth(stakeData, uint64(31 ether / 1 gwei));

        assertEq(compoundingStakingSSVStrategy.depositListLength(), 1);
    }

    function test_stakeEth_RevertWhen_depositTooSmall() public {
        _processValidator(0, 100);
        _depositToStrategy(1 ether);

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        // 0.5 ETH < 1 ETH minimum
        vm.prank(governor);
        vm.expectRevert("Deposit too small");
        compoundingStakingSSVStrategy.stakeEth(stakeData, uint64(0.5 ether / 1 gwei));
    }

    /// @dev Mirrors Hardhat line 799: "Should stake 1 ETH then 2047 ETH to a validator"
    function test_stakeEth_firstDepositThenTopUp() public {
        // 1. Register validator 0
        _registerValidator(0);

        // 2. Deposit 1 ETH and stake (first deposit)
        _depositToStrategy(1 ether);

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(governor);
        compoundingStakingSSVStrategy.stakeEth(stakeData, uint64(1 ether / 1 gwei));

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);

        // 3. Verify state is STAKED (2), firstDeposit is true, depositListLength == 1
        (ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 2, "State should be STAKED");
        assertTrue(compoundingStakingSSVStrategy.firstDeposit(), "firstDeposit should be true");
        assertEq(compoundingStakingSSVStrategy.depositListLength(), 1, "depositListLength should be 1");

        // Get pending deposit root
        bytes32 pendingDepositRoot = compoundingStakingSSVStrategy.depositList(0);

        // 4. Verify validator
        _verifyValidator(0, 100);

        // 5. Verify deposit
        _verifyDeposit(pendingDepositRoot);

        // 6. After verification: state is VERIFIED (3), firstDeposit false, depositListLength == 0
        (state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 3, "State should be VERIFIED");
        assertFalse(compoundingStakingSSVStrategy.firstDeposit(), "firstDeposit should be false after verification");
        assertEq(
            compoundingStakingSSVStrategy.depositListLength(), 0, "depositListLength should be 0 after verification"
        );

        // Record checkBalance after first deposit verified (1 ETH on beacon chain)
        uint256 checkBalanceAfterFirstDeposit = compoundingStakingSSVStrategy.checkBalance(address(mockWeth));

        // 7. Deposit 31 ETH to strategy
        _depositToStrategy(31 ether);

        // 8. Stake 31 ETH as top-up
        ValidatorStakeData memory topUpStakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(governor);
        compoundingStakingSSVStrategy.stakeEth(topUpStakeData, uint64(31 ether / 1 gwei));

        // 9. Verify depositListLength == 1 (new pending deposit)
        assertEq(compoundingStakingSSVStrategy.depositListLength(), 1, "depositListLength should be 1 after top-up");

        // 10. Verify the second deposit
        bytes32 topUpDepositRoot = compoundingStakingSSVStrategy.depositList(0);
        _verifyDeposit(topUpDepositRoot);

        // 11. depositListLength should be 0 again
        assertEq(
            compoundingStakingSSVStrategy.depositListLength(),
            0,
            "depositListLength should be 0 after second verification"
        );

        // 12. checkBalance should reflect all ETH on beacon chain (1 ETH first deposit + 31 ETH top-up)
        uint256 checkBalanceAfter = compoundingStakingSSVStrategy.checkBalance(address(mockWeth));
        assertEq(
            checkBalanceAfter,
            checkBalanceAfterFirstDeposit + 31 ether,
            "checkBalance should include both first deposit and top-up on beacon chain"
        );
    }
}
