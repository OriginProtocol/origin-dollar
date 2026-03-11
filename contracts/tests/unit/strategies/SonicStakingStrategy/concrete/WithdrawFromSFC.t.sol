// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from
    "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";
import {SonicValidatorDelegator} from "contracts/strategies/sonic/SonicValidatorDelegator.sol";
import {MockSFC} from "contracts/mocks/MockSFC.sol";

contract Unit_Concrete_SonicStakingStrategy_WithdrawFromSFC_Test is Unit_SonicStakingStrategy_Shared_Test {
    function test_withdrawFromSFC_wrapsAndTransfers() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        // Undelegate
        vm.prank(strategist);
        uint256 withdrawId = sonicStakingStrategy.undelegate(18, amount);

        // Set full refund ratio (no slashing)
        mockSfc.slashValidator(18, 1e18);
        // Fund SFC with native S for withdrawal
        vm.deal(address(mockSfc), amount);

        uint256 vaultBalBefore = mockWrappedSonic.balanceOf(address(oSonicVault));

        vm.prank(strategist);
        uint256 withdrawn = sonicStakingStrategy.withdrawFromSFC(withdrawId);

        assertEq(withdrawn, amount);
        assertEq(mockWrappedSonic.balanceOf(address(oSonicVault)) - vaultBalBefore, amount);
    }

    function test_withdrawFromSFC_clearsPendingWithdrawal() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        vm.prank(strategist);
        uint256 withdrawId = sonicStakingStrategy.undelegate(18, amount);

        assertEq(sonicStakingStrategy.pendingWithdrawals(), amount);

        mockSfc.slashValidator(18, 1e18);
        vm.deal(address(mockSfc), amount);

        vm.prank(strategist);
        sonicStakingStrategy.withdrawFromSFC(withdrawId);

        assertEq(sonicStakingStrategy.pendingWithdrawals(), 0);

        // Withdrawal request should be cleared (undelegatedAmount == 0)
        (, uint256 undelegatedAmount,) = sonicStakingStrategy.withdrawals(withdrawId);
        assertEq(undelegatedAmount, 0);
    }

    function test_withdrawFromSFC_handlesPartialSlashing() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        vm.prank(strategist);
        uint256 withdrawId = sonicStakingStrategy.undelegate(18, amount);

        // Set 50% refund ratio (50% slashing)
        mockSfc.slashValidator(18, 0.5e18);
        vm.deal(address(mockSfc), amount);

        uint256 vaultBalBefore = mockWrappedSonic.balanceOf(address(oSonicVault));

        vm.prank(strategist);
        uint256 withdrawn = sonicStakingStrategy.withdrawFromSFC(withdrawId);

        // Should get 50% back
        assertEq(withdrawn, 5 ether);
        assertEq(mockWrappedSonic.balanceOf(address(oSonicVault)) - vaultBalBefore, 5 ether);
    }

    function test_withdrawFromSFC_handlesFullSlashing() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        vm.prank(strategist);
        uint256 withdrawId = sonicStakingStrategy.undelegate(18, amount);

        // Set 0 refund ratio (100% slashing) - do not call slashValidator so ratio stays 0
        // slashingRefundRatio defaults to 0, which means full penalty
        vm.deal(address(mockSfc), amount);

        uint256 vaultBalBefore = mockWrappedSonic.balanceOf(address(oSonicVault));

        vm.prank(strategist);
        uint256 withdrawn = sonicStakingStrategy.withdrawFromSFC(withdrawId);

        // Fully slashed - should get 0 back
        assertEq(withdrawn, 0);
        assertEq(mockWrappedSonic.balanceOf(address(oSonicVault)), vaultBalBefore);
        // Pending withdrawals should be cleared
        assertEq(sonicStakingStrategy.pendingWithdrawals(), 0);
    }

    function test_withdrawFromSFC_RevertWhen_invalidWithdrawId() public {
        vm.prank(strategist);
        vm.expectRevert("Invalid withdrawId");
        sonicStakingStrategy.withdrawFromSFC(999);
    }

    function test_withdrawFromSFC_RevertWhen_alreadyWithdrawn() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        vm.prank(strategist);
        uint256 withdrawId = sonicStakingStrategy.undelegate(18, amount);

        mockSfc.slashValidator(18, 1e18);
        vm.deal(address(mockSfc), amount);

        vm.prank(strategist);
        sonicStakingStrategy.withdrawFromSFC(withdrawId);

        // Try to withdraw again
        vm.prank(strategist);
        vm.expectRevert("Already withdrawn");
        sonicStakingStrategy.withdrawFromSFC(withdrawId);
    }

    function test_withdrawFromSFC_RevertWhen_calledByNonRegistratorOrStrategist() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        vm.prank(strategist);
        uint256 withdrawId = sonicStakingStrategy.undelegate(18, amount);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Registrator or Strategist");
        sonicStakingStrategy.withdrawFromSFC(withdrawId);
    }

    function test_withdrawFromSFC_RevertWhen_sfcRevertsWithOtherError() public {
        uint256 amount = 10 ether;
        _depositAsVault(amount);

        vm.prank(strategist);
        uint256 withdrawId = sonicStakingStrategy.undelegate(18, amount);

        // Force SFC to revert with a non-StakeIsFullySlashed error
        mockSfc.slashValidator(18, 1e18);
        mockSfc.setForceWithdrawRevert(true);

        vm.prank(strategist);
        vm.expectRevert(MockSFC.NotEnoughTimePassed.selector);
        sonicStakingStrategy.withdrawFromSFC(withdrawId);
    }
}
