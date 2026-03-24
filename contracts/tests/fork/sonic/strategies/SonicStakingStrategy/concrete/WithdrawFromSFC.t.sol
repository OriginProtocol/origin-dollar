// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SonicValidatorDelegator} from "contracts/strategies/sonic/SonicValidatorDelegator.sol";
import {ISFC} from "contracts/interfaces/sonic/ISFC.sol";

import {
    Fork_SonicStakingStrategy_Shared_Test
} from "tests/fork/sonic/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Fork_Concrete_SonicStakingStrategy_WithdrawFromSFC_Test is Fork_SonicStakingStrategy_Shared_Test {
    function test_withdrawFromSFC() public {
        uint256 defaultValidatorId = sonicStakingStrategy.defaultValidatorId();
        _depositTokenAmount(15_000 ether, false);
        uint256 withdrawalId = _undelegateTokenAmount(15_000 ether, defaultValidatorId);
        _withdrawFromSFC(withdrawalId, 15_000 ether);
    }

    function test_withdrawFromSFC_partiallySlashed() public {
        uint256 defaultValidatorId = sonicStakingStrategy.defaultValidatorId();
        uint256 amount = 15_000 ether;
        _depositTokenAmount(amount, false);
        uint256 withdrawalId = _undelegateTokenAmount(amount, defaultValidatorId);

        _advanceWeek();
        _advanceWeek();

        // Slash at 95% refund (5% slashed)
        uint256 slashingRefundRatio = 95e16;
        _slashValidator(slashingRefundRatio);

        _advanceSfcEpoch(MIN_WITHDRAWAL_EPOCH_ADVANCE);

        uint256 vaultBalanceBefore = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));

        vm.prank(validatorRegistrator);
        uint256 withdrawnAmount = sonicStakingStrategy.withdrawFromSFC(withdrawalId);

        // Should receive approximately 95% of the undelegated amount
        uint256 expectedAmount = (amount * slashingRefundRatio) / 1e18;
        assertApproxEqAbs(withdrawnAmount, expectedAmount, 1, "withdrawn amount mismatch after partial slash");

        uint256 vaultBalanceAfter = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));
        assertApproxEqAbs(
            vaultBalanceAfter - vaultBalanceBefore, expectedAmount, 1, "vault balance mismatch after partial slash"
        );
    }

    function test_withdrawFromSFC_fullySlashed() public {
        uint256 defaultValidatorId = sonicStakingStrategy.defaultValidatorId();
        uint256 amount = 15_000 ether;
        _depositTokenAmount(amount, false);
        uint256 withdrawalId = _undelegateTokenAmount(amount, defaultValidatorId);

        _advanceWeek();
        _advanceWeek();

        // Slash at 0% refund (100% slashed)
        _slashValidator(0);

        _advanceSfcEpoch(MIN_WITHDRAWAL_EPOCH_ADVANCE);

        uint256 vaultBalanceBefore = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));

        vm.prank(validatorRegistrator);
        uint256 withdrawnAmount = sonicStakingStrategy.withdrawFromSFC(withdrawalId);

        // Should receive 0 when fully slashed
        assertEq(withdrawnAmount, 0, "should receive 0 when fully slashed");

        uint256 vaultBalanceAfter = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));
        assertEq(vaultBalanceAfter, vaultBalanceBefore, "vault balance should not change when fully slashed");
    }

    function test_withdrawFromSFC_RevertWhen_tooSoon() public {
        uint256 defaultValidatorId = sonicStakingStrategy.defaultValidatorId();
        _depositTokenAmount(15_000 ether, false);
        uint256 withdrawalId = _undelegateTokenAmount(15_000 ether, defaultValidatorId);

        // Only advance 1 week (need 2)
        _advanceWeek();
        _advanceSfcEpoch(MIN_WITHDRAWAL_EPOCH_ADVANCE);

        vm.prank(validatorRegistrator);
        vm.expectRevert(abi.encodeWithSignature("NotEnoughTimePassed()"));
        sonicStakingStrategy.withdrawFromSFC(withdrawalId);
    }

    function test_withdrawFromSFC_RevertWhen_tooFewEpochs() public {
        uint256 defaultValidatorId = sonicStakingStrategy.defaultValidatorId();
        _depositTokenAmount(15_000 ether, false);
        uint256 withdrawalId = _undelegateTokenAmount(15_000 ether, defaultValidatorId);

        // Advance 2 weeks but only 1 epoch
        _advanceWeek();
        _advanceWeek();
        _advanceSfcEpoch(1);

        vm.prank(validatorRegistrator);
        vm.expectRevert(abi.encodeWithSignature("NotEnoughEpochsPassed()"));
        sonicStakingStrategy.withdrawFromSFC(withdrawalId);
    }

    function test_withdrawFromSFC_multipleWithdrawals() public {
        uint256 defaultValidatorId = sonicStakingStrategy.defaultValidatorId();
        _depositTokenAmount(15_000 ether, false);

        uint256 withdrawalId1 = _undelegateTokenAmount(5_000 ether, defaultValidatorId);
        uint256 withdrawalId2 = _undelegateTokenAmount(5_000 ether, defaultValidatorId);
        uint256 withdrawalId3 = _undelegateTokenAmount(5_000 ether, defaultValidatorId);

        _advanceWeek();
        _advanceWeek();
        _advanceSfcEpoch(MIN_WITHDRAWAL_EPOCH_ADVANCE);

        uint256 vaultBalanceBefore = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));

        vm.startPrank(validatorRegistrator);
        uint256 w1 = sonicStakingStrategy.withdrawFromSFC(withdrawalId1);
        uint256 w2 = sonicStakingStrategy.withdrawFromSFC(withdrawalId2);
        uint256 w3 = sonicStakingStrategy.withdrawFromSFC(withdrawalId3);
        vm.stopPrank();

        assertApproxEqAbs(w1, 5_000 ether, 1, "withdrawal 1 amount mismatch");
        assertApproxEqAbs(w2, 5_000 ether, 1, "withdrawal 2 amount mismatch");
        assertApproxEqAbs(w3, 5_000 ether, 1, "withdrawal 3 amount mismatch");

        uint256 vaultBalanceAfter = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));
        assertApproxEqAbs(vaultBalanceAfter - vaultBalanceBefore, 15_000 ether, 3, "total vault balance mismatch");
    }
}
