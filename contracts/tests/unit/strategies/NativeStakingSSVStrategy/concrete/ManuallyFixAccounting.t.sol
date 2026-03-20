// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_NativeStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_NativeStakingSSVStrategy_ManuallyFixAccounting_Test
    is Unit_NativeStakingSSVStrategy_Shared_Test
{
    // ----------------
    // Access control
    // ----------------

    function test_manuallyFixAccounting_RevertWhen_callerNotStrategist() public {
        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();

        vm.prank(governor);
        vm.expectRevert("Caller is not the Strategist");
        nativeStakingSSVStrategy.manuallyFixAccounting(1, 2 ether, 2 ether);
    }

    function test_manuallyFixAccounting_RevertWhen_notPaused() public {
        vm.prank(strategist);
        vm.expectRevert("Pausable: not paused");
        nativeStakingSSVStrategy.manuallyFixAccounting(1, 2 ether, 2 ether);
    }

    // ----------------
    // Validators delta bounds
    // ----------------

    function test_manuallyFixAccounting_RevertWhen_validatorsDeltaTooNegative() public {
        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        vm.prank(strategist);
        vm.expectRevert("Invalid validatorsDelta");
        nativeStakingSSVStrategy.manuallyFixAccounting(-4, 0, 0);
    }

    function test_manuallyFixAccounting_RevertWhen_validatorsDeltaTooPositive() public {
        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        vm.prank(strategist);
        vm.expectRevert("Invalid validatorsDelta");
        nativeStakingSSVStrategy.manuallyFixAccounting(4, 0, 0);
    }

    // ----------------
    // Consensus rewards delta bounds
    // ----------------

    function test_manuallyFixAccounting_RevertWhen_consensusRewardsDeltaTooNegative() public {
        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        vm.prank(strategist);
        vm.expectRevert("Invalid consensusRewardsDelta");
        nativeStakingSSVStrategy.manuallyFixAccounting(0, -333 ether, 0);
    }

    function test_manuallyFixAccounting_RevertWhen_consensusRewardsDeltaTooPositive() public {
        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        vm.prank(strategist);
        vm.expectRevert("Invalid consensusRewardsDelta");
        nativeStakingSSVStrategy.manuallyFixAccounting(0, 333 ether, 0);
    }

    // ----------------
    // ETH to vault bounds
    // ----------------

    function test_manuallyFixAccounting_RevertWhen_ethToVaultTooHigh() public {
        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        vm.prank(strategist);
        vm.expectRevert("Invalid wethToVaultAmount");
        nativeStakingSSVStrategy.manuallyFixAccounting(0, 0, 97 ether);
    }

    // ----------------
    // Recovery: validators delta
    // ----------------

    function test_manuallyFixAccounting_changeValidatorsBy_minus3() public {
        _testValidatorsDelta(-3);
    }

    function test_manuallyFixAccounting_changeValidatorsBy_minus2() public {
        _testValidatorsDelta(-2);
    }

    function test_manuallyFixAccounting_changeValidatorsBy_minus1() public {
        _testValidatorsDelta(-1);
    }

    function test_manuallyFixAccounting_changeValidatorsBy_0() public {
        _testValidatorsDelta(0);
    }

    function test_manuallyFixAccounting_changeValidatorsBy_plus1() public {
        _testValidatorsDelta(1);
    }

    function test_manuallyFixAccounting_changeValidatorsBy_plus2() public {
        _testValidatorsDelta(2);
    }

    function test_manuallyFixAccounting_changeValidatorsBy_plus3() public {
        _testValidatorsDelta(3);
    }

    function _testValidatorsDelta(int256 delta) internal {
        _setActiveDepositedValidators(10);

        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        uint256 validatorsBefore = nativeStakingSSVStrategy.activeDepositedValidators();

        vm.prank(strategist);
        vm.expectEmit(true, true, true, true);
        emit AccountingManuallyFixed(delta, 0, 0);
        nativeStakingSSVStrategy.manuallyFixAccounting(delta, 0, 0);

        assertEq(
            nativeStakingSSVStrategy.activeDepositedValidators(),
            uint256(int256(validatorsBefore) + delta)
        );
    }

    // ----------------
    // Recovery: consensus rewards delta
    // ----------------

    function test_manuallyFixAccounting_changeConsensusRewards_minus332() public {
        _testConsensusRewardsDelta(-332);
    }

    function test_manuallyFixAccounting_changeConsensusRewards_minus320() public {
        _testConsensusRewardsDelta(-320);
    }

    function test_manuallyFixAccounting_changeConsensusRewards_minus1() public {
        _testConsensusRewardsDelta(-1);
    }

    function test_manuallyFixAccounting_changeConsensusRewards_0() public {
        _testConsensusRewardsDelta(0);
    }

    function test_manuallyFixAccounting_changeConsensusRewards_plus1() public {
        _testConsensusRewardsDelta(1);
    }

    function test_manuallyFixAccounting_changeConsensusRewards_plus320() public {
        _testConsensusRewardsDelta(320);
    }

    function test_manuallyFixAccounting_changeConsensusRewards_plus332() public {
        _testConsensusRewardsDelta(332);
    }

    function _testConsensusRewardsDelta(int256 deltaEth) internal {
        vm.deal(address(nativeStakingSSVStrategy), 670 ether);
        _setConsensusRewards(336 ether);
        _setActiveDepositedValidators(10_000);

        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        int256 consensusRewardsDelta = deltaEth * 1 ether;

        vm.prank(strategist);
        vm.expectEmit(true, true, true, true);
        emit AccountingManuallyFixed(0, consensusRewardsDelta, 0);
        nativeStakingSSVStrategy.manuallyFixAccounting(0, consensusRewardsDelta, 0);

        assertEq(
            nativeStakingSSVStrategy.consensusRewards(),
            address(nativeStakingSSVStrategy).balance
        );
    }

    // ----------------
    // Recovery: ethToVault
    // ----------------

    function test_manuallyFixAccounting_ethToVault_0() public {
        _testEthToVault(0);
    }

    function test_manuallyFixAccounting_ethToVault_1() public {
        _testEthToVault(1);
    }

    function test_manuallyFixAccounting_ethToVault_26() public {
        _testEthToVault(26);
    }

    function test_manuallyFixAccounting_ethToVault_32() public {
        _testEthToVault(32);
    }

    function test_manuallyFixAccounting_ethToVault_63() public {
        _testEthToVault(63);
    }

    function test_manuallyFixAccounting_ethToVault_65() public {
        _testEthToVault(65);
    }

    function test_manuallyFixAccounting_ethToVault_95() public {
        _testEthToVault(95);
    }

    function _testEthToVault(uint256 ethAmount) internal {
        uint256 wethToVault = ethAmount * 1 ether;

        // Add extra ETH so we don't empty the contract
        vm.deal(address(nativeStakingSSVStrategy), wethToVault + 2 ether);

        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        uint256 ethBefore = address(nativeStakingSSVStrategy).balance;

        vm.prank(strategist);
        vm.expectEmit(true, true, true, true);
        emit AccountingManuallyFixed(0, 0, wethToVault);
        nativeStakingSSVStrategy.manuallyFixAccounting(0, 0, wethToVault);

        assertEq(address(nativeStakingSSVStrategy).balance, ethBefore - wethToVault);
        assertEq(
            nativeStakingSSVStrategy.consensusRewards(),
            address(nativeStakingSSVStrategy).balance
        );
    }

    // ----------------
    // Recovery: slashed validator
    // ----------------

    function test_manuallyFixAccounting_slashedValidatorRecovery() public {
        // Setup 1 validator
        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);
        vm.prank(strategist);
        nativeStakingSSVStrategy.manuallyFixAccounting(1, 0, 0);

        // Validator slashed with 24 ETH remaining
        vm.deal(address(nativeStakingSSVStrategy), 24 ether);

        // Fuse blown
        vm.prank(governor);
        nativeStakingSSVStrategy.doAccounting();
        assertTrue(nativeStakingSSVStrategy.paused());

        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        // Fix by removing 1 validator and sending 24 ETH to vault
        vm.prank(strategist);
        vm.expectEmit(true, true, true, true);
        emit AccountingManuallyFixed(-1, 0, 24 ether);
        nativeStakingSSVStrategy.manuallyFixAccounting(-1, 0, 24 ether);
    }

    // ----------------
    // Recovery: all three delta values
    // ----------------

    function test_manuallyFixAccounting_allThreeDeltas() public {
        vm.deal(address(nativeStakingSSVStrategy), 5 ether);
        // Send WETH to strategy
        vm.prank(josh);
        weth.transfer(address(nativeStakingSSVStrategy), 5 ether);

        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        vm.prank(strategist);
        vm.expectEmit(true, true, true, true);
        emit AccountingManuallyFixed(1, 2.3 ether, 2.2 ether);
        nativeStakingSSVStrategy.manuallyFixAccounting(1, 2.3 ether, 2.2 ether);
    }

    // ----------------
    // Cadence check
    // ----------------

    function test_manuallyFixAccounting_RevertWhen_calledTooSoon() public {
        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        vm.prank(strategist);
        nativeStakingSSVStrategy.manuallyFixAccounting(0, 0, 0);

        // Pause again and try immediately
        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE - 3);

        vm.prank(strategist);
        vm.expectRevert("Fix accounting called too soon");
        nativeStakingSSVStrategy.manuallyFixAccounting(0, 0, 0);
    }

    function test_manuallyFixAccounting_calledTwiceWithEnoughBlocks() public {
        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        vm.prank(strategist);
        nativeStakingSSVStrategy.manuallyFixAccounting(0, 0, 0);

        vm.prank(strategist);
        nativeStakingSSVStrategy.pause();
        vm.roll(block.number + MIN_FIX_ACCOUNTING_CADENCE + 1);

        vm.prank(strategist);
        nativeStakingSSVStrategy.manuallyFixAccounting(0, 0, 0);
    }

    // ----------------
    // Events
    // ----------------

    event AccountingManuallyFixed(int256 validatorsDelta, int256 consensusRewardsDelta, uint256 wethToVault);
}
