// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingStrategy/shared/Shared.t.sol";

// --- Project imports
import {ICompoundingStakingStrategy} from "contracts/interfaces/strategies/ICompoundingStakingStrategy.sol";
import {Endian} from "contracts/beacon/Endian.sol";
import {
    CompoundingValidatorStakeData as ValidatorStakeData,
    CompoundingValidatorState as ValidatorState
} from "contracts/interfaces/strategies/CompoundingStakingTypes.sol";

contract Unit_Concrete_CompoundingStakingStrategy_ValidatorStaking_Test is Unit_CompoundingStakingStrategy_Shared_Test {
    function setUp() public override {
        super.setUp();
    }

    function test_stakeEth_firstDeposit() public {
        _depositToStrategy(1 ether);

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        bytes32 pendingDepositRoot = _stakeWithExpectedEvent(0, 1 ether);

        // State should be STAKED (2)
        (ValidatorState state,) = compoundingStakingStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 2);

        // firstDeposit should be true
        assertTrue(compoundingStakingStrategy.firstDeposit());

        // Should have 1 pending deposit
        assertEq(compoundingStakingStrategy.depositListLength(), 1);
        assertEq(compoundingStakingStrategy.depositList(0), pendingDepositRoot);
    }

    function test_stakeEth_firstDepositBelowConfiguredAmount() public {
        vm.prank(governor);
        compoundingStakingStrategy.setInitialDepositAmount(2 ether);
        _depositToStrategy(1 ether);

        _stakeWithExpectedEvent(0, 1 ether);

        assertTrue(compoundingStakingStrategy.firstDeposit());
        assertEq(compoundingStakingStrategy.depositListLength(), 1);
    }

    function test_stakeEth_largeFirstDeposit() public {
        vm.prank(governor);
        compoundingStakingStrategy.setInitialDepositAmount(2030 ether);
        _depositToStrategy(2030 ether);

        _stakeWithExpectedEvent(0, 2030 ether);

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        (ValidatorState state,) = compoundingStakingStrategy.validator(pubKeyHash);
        assertEq(uint8(state), uint8(ValidatorState.STAKED));
        assertTrue(compoundingStakingStrategy.firstDeposit());
    }

    function test_stakeEth_32Point25EtherBelowConfiguredAmount() public {
        vm.prank(governor);
        compoundingStakingStrategy.setInitialDepositAmount(2040 ether);
        _depositToStrategy(32.25 ether);

        _stakeWithExpectedEvent(0, 32.25 ether);

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);
        (ValidatorState state,) = compoundingStakingStrategy.validator(pubKeyHash);
        assertEq(uint8(state), uint8(ValidatorState.STAKED));
        assertTrue(compoundingStakingStrategy.firstDeposit());
    }

    function test_stakeEth_RevertWhen_aboveInitialDepositAmount() public {
        _depositToStrategy(2 ether);

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(governor);
        vm.expectRevert(ICompoundingStakingStrategy.InvalidFirstDepositAmount.selector);
        compoundingStakingStrategy.stakeEth(stakeData, uint64(2 ether / 1 gwei));
    }

    function test_stakeEth_RevertWhen_existingFirstDeposit() public {
        // First validator first deposit
        _stakeNewValidator(0);
        assertTrue(compoundingStakingStrategy.firstDeposit());

        // Second validator should fail
        _depositToStrategy(1 ether);

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[1].publicKey,
            signature: testValidators[1].signature,
            depositDataRoot: testValidators[1].depositDataRoot
        });

        vm.prank(governor);
        vm.expectRevert("Existing first deposit");
        compoundingStakingStrategy.stakeEth(stakeData, uint64(1 ether / 1 gwei));
    }

    function test_stakeEth_RevertWhen_sameValidatorNotVerified() public {
        _stakeNewValidator(0);
        _depositToStrategy(1 ether);
        ValidatorStakeData memory stakeData = _validatorStakeData(0, 1 ether);

        vm.prank(governor);
        vm.expectRevert("Not registered or verified");
        compoundingStakingStrategy.stakeEth(stakeData, uint64(1 ether / 1 gwei));
    }

    function test_stakeEth_RevertWhen_insufficientWeth() public {
        // Don't deposit WETH

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(governor);
        vm.expectRevert("Insufficient WETH");
        compoundingStakingStrategy.stakeEth(stakeData, uint64(1 ether / 1 gwei));
    }

    function test_stakeEth_RevertWhen_paused() public {
        _depositToStrategy(1 ether);

        vm.prank(governor);
        compoundingStakingStrategy.pause();

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(governor);
        vm.expectRevert("Pausable: paused");
        compoundingStakingStrategy.stakeEth(stakeData, uint64(1 ether / 1 gwei));
    }

    function test_stakeEth_RevertWhen_notRegistrator() public {
        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(josh);
        vm.expectRevert(ICompoundingStakingStrategy.NotRegistrator.selector);
        compoundingStakingStrategy.stakeEth(stakeData, uint64(1 ether / 1 gwei));
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
        compoundingStakingStrategy.stakeEth(stakeData, uint64(31 ether / 1 gwei));

        assertEq(compoundingStakingStrategy.depositListLength(), 1);
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
        compoundingStakingStrategy.stakeEth(stakeData, uint64(0.5 ether / 1 gwei));
    }

    /// @dev Mirrors Hardhat line 799: "Should stake 1 ETH then 2047 ETH to a validator"
    function test_stakeEth_firstDepositThenTopUp() public {
        // 1. Stake validator 0

        // 2. Deposit 1 ETH and stake (first deposit)
        _depositToStrategy(1 ether);

        ValidatorStakeData memory stakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(governor);
        compoundingStakingStrategy.stakeEth(stakeData, uint64(1 ether / 1 gwei));

        bytes32 pubKeyHash = _hashPubKey(testValidators[0].publicKey);

        // 3. Verify state is STAKED (2), firstDeposit is true, depositListLength == 1
        (ValidatorState state,) = compoundingStakingStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 2, "State should be STAKED");
        assertTrue(compoundingStakingStrategy.firstDeposit(), "firstDeposit should be true");
        assertEq(compoundingStakingStrategy.depositListLength(), 1, "depositListLength should be 1");

        // Get pending deposit root
        bytes32 pendingDepositRoot = compoundingStakingStrategy.depositList(0);

        // 4. Verify validator
        _verifyValidator(0, 100);

        // 5. Verify deposit
        _verifyDeposit(pendingDepositRoot);

        // 6. After verification: state is VERIFIED (3), firstDeposit false, depositListLength == 0
        (state,) = compoundingStakingStrategy.validator(pubKeyHash);
        assertEq(uint8(state), 3, "State should be VERIFIED");
        assertFalse(compoundingStakingStrategy.firstDeposit(), "firstDeposit should be false after verification");
        assertEq(compoundingStakingStrategy.depositListLength(), 0, "depositListLength should be 0 after verification");

        // Record checkBalance after first deposit verified (1 ETH on beacon chain)
        uint256 checkBalanceAfterFirstDeposit = compoundingStakingStrategy.checkBalance(address(mockWeth));

        // 7. Deposit 31 ETH to strategy
        _depositToStrategy(31 ether);

        // 8. Stake 31 ETH as top-up
        ValidatorStakeData memory topUpStakeData = ValidatorStakeData({
            pubkey: testValidators[0].publicKey,
            signature: testValidators[0].signature,
            depositDataRoot: testValidators[0].depositDataRoot
        });

        vm.prank(governor);
        compoundingStakingStrategy.stakeEth(topUpStakeData, uint64(31 ether / 1 gwei));

        // 9. Verify depositListLength == 1 (new pending deposit)
        assertEq(compoundingStakingStrategy.depositListLength(), 1, "depositListLength should be 1 after top-up");

        // 10. Verify the second deposit
        bytes32 topUpDepositRoot = compoundingStakingStrategy.depositList(0);
        _verifyDeposit(topUpDepositRoot);

        // 11. depositListLength should be 0 again
        assertEq(
            compoundingStakingStrategy.depositListLength(), 0, "depositListLength should be 0 after second verification"
        );

        // 12. checkBalance should reflect all ETH on beacon chain (1 ETH first deposit + 31 ETH top-up)
        uint256 checkBalanceAfter = compoundingStakingStrategy.checkBalance(address(mockWeth));
        assertEq(
            checkBalanceAfter,
            checkBalanceAfterFirstDeposit + 31 ether,
            "checkBalance should include both first deposit and top-up on beacon chain"
        );
    }

    function _stakeWithExpectedEvent(uint256 validatorIndex, uint256 amountWei)
        internal
        returns (bytes32 pendingDepositRoot)
    {
        TestValidator storage validatorData = testValidators[validatorIndex];
        bytes32 pubKeyHash = _hashPubKey(validatorData.publicKey);
        uint64 amountGwei = uint64(amountWei / 1 gwei);
        pendingDepositRoot = mockBeaconProofs.merkleizePendingDeposit(
            pubKeyHash,
            abi.encodePacked(_withdrawalCredentialsBytes32()),
            amountGwei,
            validatorData.signature,
            _calcSlot(block.timestamp)
        );
        ValidatorStakeData memory stakeData = _validatorStakeData(validatorIndex, amountWei);

        vm.expectEmit(true, true, false, true, address(compoundingStakingStrategy));
        emit ICompoundingStakingStrategy.ETHStaked(pubKeyHash, pendingDepositRoot, validatorData.publicKey, amountWei);
        vm.prank(governor);
        compoundingStakingStrategy.stakeEth(stakeData, amountGwei);
    }

    function _validatorStakeData(uint256 validatorIndex, uint256 amountWei)
        internal
        view
        returns (ValidatorStakeData memory)
    {
        TestValidator storage validatorData = testValidators[validatorIndex];
        return ValidatorStakeData({
            pubkey: validatorData.publicKey,
            signature: validatorData.signature,
            depositDataRoot: _depositDataRoot(
                validatorData.publicKey, validatorData.signature, uint64(amountWei / 1 gwei)
            )
        });
    }

    function _depositDataRoot(bytes memory pubkey, bytes memory signature, uint64 amountGwei)
        internal
        view
        returns (bytes32)
    {
        bytes32 signaturePart0;
        bytes32 signaturePart1;
        bytes32 signaturePart2;
        assembly {
            signaturePart0 := mload(add(signature, 0x20))
            signaturePart1 := mload(add(signature, 0x40))
            signaturePart2 := mload(add(signature, 0x60))
        }

        bytes32 pubkeyRoot = sha256(abi.encodePacked(pubkey, bytes16(0)));
        bytes32 signatureRoot = sha256(
            abi.encodePacked(
                sha256(abi.encodePacked(signaturePart0, signaturePart1)),
                sha256(abi.encodePacked(signaturePart2, bytes32(0)))
            )
        );
        return sha256(
            abi.encodePacked(
                sha256(abi.encodePacked(pubkeyRoot, _withdrawalCredentialsBytes32())),
                sha256(abi.encodePacked(Endian.toLittleEndianUint64(amountGwei), signatureRoot))
            )
        );
    }
}
