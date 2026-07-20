// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";

// --- Project imports
import {ICompoundingStakingSSVStrategy} from "contracts/interfaces/strategies/ICompoundingStakingSSVStrategy.sol";
import {CompoundingStakingSSVStrategy} from "contracts/strategies/NativeStaking/CompoundingStakingSSVStrategy.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_Configuration_Test is
    Unit_CompoundingStakingSSVStrategy_Shared_Test
{
    function test_setRegistrator() public {
        vm.prank(governor);
        vm.expectEmit(true, false, false, false);
        emit ICompoundingStakingSSVStrategy.RegistratorChanged(strategist);
        compoundingStakingSSVStrategy.setRegistrator(strategist);

        assertEq(compoundingStakingSSVStrategy.validatorRegistrator(), strategist);
    }

    function test_setRegistrator_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        compoundingStakingSSVStrategy.setRegistrator(strategist);
    }

    function test_supportsAsset_weth() public view {
        assertTrue(compoundingStakingSSVStrategy.supportsAsset(address(mockWeth)));
    }

    function test_supportsAsset_notWeth() public view {
        assertFalse(compoundingStakingSSVStrategy.supportsAsset(address(mockSsv)));
    }

    /// @dev `resetFirstDeposit` is callable by the Governor or the Strategist.
    ///      Reaching the NoFirstDeposit revert proves the Strategist passed the
    ///      authorization check.
    function test_resetFirstDeposit_allowsStrategist() public {
        vm.prank(strategist);
        vm.expectRevert(ICompoundingStakingSSVStrategy.NoFirstDeposit.selector);
        compoundingStakingSSVStrategy.resetFirstDeposit();
    }

    function test_resetFirstDeposit_RevertWhen_notGovernorOrStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        compoundingStakingSSVStrategy.resetFirstDeposit();
    }

    function test_resetFirstDeposit_RevertWhen_noFirstDeposit() public {
        vm.prank(governor);
        vm.expectRevert(ICompoundingStakingSSVStrategy.NoFirstDeposit.selector);
        compoundingStakingSSVStrategy.resetFirstDeposit();
    }

    function test_resetFirstDeposit() public {
        // Register and stake to set firstDeposit = true
        _registerAndStake(0);
        assertTrue(compoundingStakingSSVStrategy.firstDeposit());

        vm.prank(governor);
        vm.expectEmit(false, false, false, false);
        emit ICompoundingStakingSSVStrategy.FirstDepositReset();
        compoundingStakingSSVStrategy.resetFirstDeposit();

        assertFalse(compoundingStakingSSVStrategy.firstDeposit());
    }

    function test_pause_byGovernor() public {
        vm.prank(governor);
        compoundingStakingSSVStrategy.pause();
        assertTrue(compoundingStakingSSVStrategy.paused());
    }

    function test_pause_byRegistrator() public {
        vm.prank(governor);
        compoundingStakingSSVStrategy.pause();
        vm.prank(governor);
        compoundingStakingSSVStrategy.unPause();

        // Change registrator then pause
        vm.prank(governor);
        compoundingStakingSSVStrategy.setRegistrator(matt);
        vm.prank(matt);
        compoundingStakingSSVStrategy.pause();
        assertTrue(compoundingStakingSSVStrategy.paused());
    }

    function test_pause_RevertWhen_notRegistratorOrGovernor() public {
        vm.prank(josh);
        vm.expectRevert(ICompoundingStakingSSVStrategy.NotRegistratorOrGovernor.selector);
        compoundingStakingSSVStrategy.pause();
    }

    function test_unPause_onlyGovernor() public {
        vm.prank(governor);
        compoundingStakingSSVStrategy.pause();

        vm.prank(governor);
        compoundingStakingSSVStrategy.unPause();
        assertFalse(compoundingStakingSSVStrategy.paused());
    }

    function test_safeApproveAllTokens_isNoOp() public {
        // safeApproveAllTokens is now a no-op in CompoundingStakingSSVStrategy
        compoundingStakingSSVStrategy.safeApproveAllTokens();
    }

    // ----------------
    // Initial deposit amount
    // ----------------

    /// @dev compoundingSSVStaking.js "Should initialize the first deposit amount to 1 ETH"
    function test_initialDepositAmountWei_defaultsToOneEther() public view {
        assertEq(_ssvStrat().initialDepositAmountWei(), 1 ether);
    }

    /// @dev compoundingSSVStaking.js "Governor should be able to change the first deposit amount"
    function test_setInitialDepositAmount() public {
        vm.prank(governor);
        vm.expectEmit(false, false, false, true);
        emit InitialDepositAmountChanged(2 ether);
        _ssvStrat().setInitialDepositAmount(2 ether);

        assertEq(_ssvStrat().initialDepositAmountWei(), 2 ether);
    }

    /// @dev compoundingSSVStaking.js "Non governor should not be able to change the first deposit amount"
    function test_setInitialDepositAmount_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        _ssvStrat().setInitialDepositAmount(2 ether);
    }

    /// @dev compoundingSSVStaking.js "Should revert when setting the first deposit amount below 1 ETH"
    function test_setInitialDepositAmount_RevertWhen_belowMin() public {
        vm.prank(governor);
        vm.expectRevert("Deposit too small");
        _ssvStrat().setInitialDepositAmount(1 ether - 1);
    }

    /// @dev compoundingSSVStaking.js "Should revert when setting the first deposit amount above 2048 ETH"
    function test_setInitialDepositAmount_RevertWhen_aboveMax() public {
        vm.prank(governor);
        vm.expectRevert("Deposit too large");
        _ssvStrat().setInitialDepositAmount(2048 ether + 1);
    }

    /// @dev ICompoundingStakingSSVStrategy does not expose the initial-deposit getter/setter,
    ///      so cast to the concrete type for these config tests.
    function _ssvStrat() private view returns (CompoundingStakingSSVStrategy) {
        return CompoundingStakingSSVStrategy(payable(address(compoundingStakingSSVStrategy)));
    }

    // ----------------
    // Events
    // ----------------

    event RegistratorChanged(address indexed newAddress);
    event FirstDepositReset();
    event InitialDepositAmountChanged(uint256 amountWei);
}
