// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingStrategy/shared/Shared.t.sol";

// --- Project imports
import {ICompoundingStakingStrategy} from "contracts/interfaces/strategies/ICompoundingStakingStrategy.sol";

contract Unit_Concrete_CompoundingStakingStrategy_Configuration_Test is Unit_CompoundingStakingStrategy_Shared_Test {
    function test_setRegistrator() public {
        vm.prank(governor);
        vm.expectEmit(true, false, false, false);
        emit ICompoundingStakingStrategy.RegistratorChanged(strategist);
        compoundingStakingStrategy.setRegistrator(strategist);

        assertEq(compoundingStakingStrategy.validatorRegistrator(), strategist);
    }

    function test_setRegistrator_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        compoundingStakingStrategy.setRegistrator(strategist);
    }

    function test_supportsAsset_weth() public view {
        assertTrue(compoundingStakingStrategy.supportsAsset(address(mockWeth)));
    }

    function test_supportsAsset_notWeth() public view {
        assertFalse(compoundingStakingStrategy.supportsAsset(address(unsupportedToken)));
    }

    function test_resetFirstDeposit_allowsStrategist() public {
        _stakeNewValidator(0);
        assertTrue(compoundingStakingStrategy.firstDeposit());

        vm.prank(strategist);
        vm.expectEmit(false, false, false, false);
        emit ICompoundingStakingStrategy.FirstDepositReset();
        compoundingStakingStrategy.resetFirstDeposit();

        assertFalse(compoundingStakingStrategy.firstDeposit());
    }

    function test_resetFirstDeposit_RevertWhen_notGovernorOrStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        compoundingStakingStrategy.resetFirstDeposit();
    }

    function test_resetFirstDeposit_RevertWhen_noFirstDeposit() public {
        vm.prank(governor);
        vm.expectRevert(ICompoundingStakingStrategy.NoFirstDeposit.selector);
        compoundingStakingStrategy.resetFirstDeposit();
    }

    function test_resetFirstDeposit() public {
        // Stake to set firstDeposit = true
        _stakeNewValidator(0);
        assertTrue(compoundingStakingStrategy.firstDeposit());

        vm.prank(governor);
        vm.expectEmit(false, false, false, false);
        emit ICompoundingStakingStrategy.FirstDepositReset();
        compoundingStakingStrategy.resetFirstDeposit();

        assertFalse(compoundingStakingStrategy.firstDeposit());
    }

    function test_pause_byGovernor() public {
        vm.prank(governor);
        compoundingStakingStrategy.pause();
        assertTrue(compoundingStakingStrategy.paused());
    }

    function test_pause_byRegistrator() public {
        vm.prank(governor);
        compoundingStakingStrategy.pause();
        vm.prank(governor);
        compoundingStakingStrategy.unPause();

        // Change registrator then pause
        vm.prank(governor);
        compoundingStakingStrategy.setRegistrator(matt);
        vm.prank(matt);
        compoundingStakingStrategy.pause();
        assertTrue(compoundingStakingStrategy.paused());
    }

    function test_pause_RevertWhen_notRegistratorOrGovernor() public {
        vm.prank(josh);
        vm.expectRevert(ICompoundingStakingStrategy.NotRegistratorOrGovernor.selector);
        compoundingStakingStrategy.pause();
    }

    function test_unPause_onlyGovernor() public {
        vm.prank(governor);
        compoundingStakingStrategy.pause();

        vm.prank(governor);
        compoundingStakingStrategy.unPause();
        assertFalse(compoundingStakingStrategy.paused());
    }

    function test_safeApproveAllTokens_isNoOp() public {
        // safeApproveAllTokens is now a no-op in CompoundingStakingStrategy
        compoundingStakingStrategy.safeApproveAllTokens();
    }

    // ----------------
    // Initial deposit amount
    // ----------------

    /// @dev compoundingStaking.js "Should initialize the first deposit amount to 1 ETH"
    function test_initialDepositAmountWei_defaultsToOneEther() public view {
        assertEq(compoundingStakingStrategy.initialDepositAmountWei(), 1 ether);
    }

    /// @dev compoundingStaking.js "Governor should be able to change the first deposit amount"
    function test_setInitialDepositAmount() public {
        vm.prank(governor);
        vm.expectEmit(false, false, false, true);
        emit InitialDepositAmountChanged(2 ether);
        compoundingStakingStrategy.setInitialDepositAmount(2 ether);

        assertEq(compoundingStakingStrategy.initialDepositAmountWei(), 2 ether);
    }

    /// @dev compoundingStaking.js "Non governor should not be able to change the first deposit amount"
    function test_setInitialDepositAmount_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        compoundingStakingStrategy.setInitialDepositAmount(2 ether);
    }

    /// @dev compoundingStaking.js "Should revert when setting the first deposit amount below 1 ETH"
    function test_setInitialDepositAmount_RevertWhen_belowMin() public {
        vm.prank(governor);
        vm.expectRevert("Deposit too small");
        compoundingStakingStrategy.setInitialDepositAmount(1 ether - 1);
    }

    /// @dev compoundingStaking.js "Should revert when setting the first deposit amount above 2048 ETH"
    function test_setInitialDepositAmount_RevertWhen_aboveMax() public {
        vm.prank(governor);
        vm.expectRevert("Deposit too large");
        compoundingStakingStrategy.setInitialDepositAmount(2048 ether + 1);
    }

    // ----------------
    // Events
    // ----------------

    event RegistratorChanged(address indexed newAddress);
    event FirstDepositReset();
    event InitialDepositAmountChanged(uint256 amountWei);
}
