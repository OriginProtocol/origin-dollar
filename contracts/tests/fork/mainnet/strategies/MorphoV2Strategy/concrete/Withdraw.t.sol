// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Mainnet} from "tests/utils/Addresses.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

import {Fork_MorphoV2Strategy_Shared_Test} from "tests/fork/mainnet/strategies/MorphoV2Strategy/shared/Shared.t.sol";

contract Fork_Concrete_MorphoV2Strategy_Withdraw_Test is Fork_MorphoV2Strategy_Shared_Test {
    function test_withdraw_sendsUsdcToRecipient() public {
        uint256 depositAmount = 10_000e6;
        uint256 withdrawAmount = 1000e6;

        _depositAsVault(depositAmount);

        uint256 aliceBefore = IERC20(Mainnet.USDC).balanceOf(alice);

        vm.prank(address(ousdVault));
        strategy.withdraw(alice, Mainnet.USDC, withdrawAmount);

        uint256 aliceAfter = IERC20(Mainnet.USDC).balanceOf(alice);
        assertEq(aliceAfter - aliceBefore, withdrawAmount);
    }

    function test_withdraw_emitsWithdrawalEvent() public {
        uint256 depositAmount = 10_000e6;
        uint256 withdrawAmount = 1000e6;

        _depositAsVault(depositAmount);

        vm.prank(address(ousdVault));
        vm.expectEmit(true, false, false, true, address(strategy));
        emit InitializableAbstractStrategy.Withdrawal(Mainnet.USDC, Mainnet.MorphoOUSDv2Vault, withdrawAmount);
        strategy.withdraw(alice, Mainnet.USDC, withdrawAmount);
    }

    function test_withdraw_decreasesCheckBalance() public {
        uint256 depositAmount = 10_000e6;
        uint256 withdrawAmount = 1000e6;

        _depositAsVault(depositAmount);

        uint256 balBefore = strategy.checkBalance(Mainnet.USDC);

        vm.prank(address(ousdVault));
        strategy.withdraw(alice, Mainnet.USDC, withdrawAmount);

        uint256 balAfter = strategy.checkBalance(Mainnet.USDC);
        assertLt(balAfter, balBefore);
        assertApproxEqRel(balBefore - balAfter, withdrawAmount, 1e16); // 1% tolerance
    }

    function test_withdraw_RevertWhen_calledByNonVault() public {
        uint256 depositAmount = 10_000e6;
        _depositAsVault(depositAmount);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        strategy.withdraw(alice, Mainnet.USDC, 1000e6);
    }
}
