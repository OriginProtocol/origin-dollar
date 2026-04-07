// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Mainnet} from "tests/utils/Addresses.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMorphoV2Strategy} from "contracts/interfaces/strategies/IMorphoV2Strategy.sol";

import {Fork_MorphoV2Strategy_Shared_Test} from "tests/fork/mainnet/strategies/MorphoV2Strategy/shared/Shared.t.sol";

contract Fork_Concrete_MorphoV2Strategy_WithdrawAll_Test is Fork_MorphoV2Strategy_Shared_Test {
    function test_withdrawAll_sendsUsdcToVault() public {
        uint256 depositAmount = 10_000e6;

        _depositAsVault(depositAmount);

        uint256 vaultBefore = IERC20(Mainnet.USDC).balanceOf(address(ousdVault));

        vm.prank(address(ousdVault));
        strategy.withdrawAll();

        uint256 vaultAfter = IERC20(Mainnet.USDC).balanceOf(address(ousdVault));
        assertGt(vaultAfter, vaultBefore);
    }

    function test_withdrawAll_emitsWithdrawalEvent() public {
        uint256 depositAmount = 10_000e6;

        _depositAsVault(depositAmount);

        vm.prank(address(ousdVault));
        vm.expectEmit(true, false, false, false, address(strategy));
        emit IMorphoV2Strategy.Withdrawal(Mainnet.USDC, Mainnet.MorphoOUSDv2Vault, 0);
        strategy.withdrawAll();
    }

    function test_withdrawAll_withdrawsUpToMaxWithdraw() public {
        uint256 depositAmount = 10_000e6;

        _depositAsVault(depositAmount);

        uint256 maxWithdrawBefore = strategy.maxWithdraw();
        uint256 vaultBefore = IERC20(Mainnet.USDC).balanceOf(address(ousdVault));

        vm.prank(address(ousdVault));
        strategy.withdrawAll();

        uint256 vaultAfter = IERC20(Mainnet.USDC).balanceOf(address(ousdVault));
        uint256 withdrawn = vaultAfter - vaultBefore;

        assertLe(withdrawn, maxWithdrawBefore);
    }

    function test_withdrawAll_calledByGovernor() public {
        uint256 depositAmount = 10_000e6;

        _depositAsVault(depositAmount);

        uint256 vaultBefore = IERC20(Mainnet.USDC).balanceOf(address(ousdVault));

        vm.prank(governor);
        strategy.withdrawAll();

        uint256 vaultAfter = IERC20(Mainnet.USDC).balanceOf(address(ousdVault));
        assertGt(vaultAfter, vaultBefore);
    }

    function test_withdrawAll_RevertWhen_calledByNonVaultOrGovernor() public {
        uint256 depositAmount = 10_000e6;

        _depositAsVault(depositAmount);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault or Governor");
        strategy.withdrawAll();
    }
}
