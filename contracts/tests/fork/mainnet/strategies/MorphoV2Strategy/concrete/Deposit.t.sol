// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Mainnet} from "tests/utils/Addresses.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMorphoV2Strategy} from "contracts/interfaces/strategies/IMorphoV2Strategy.sol";

import {Fork_MorphoV2Strategy_Shared_Test} from "tests/fork/mainnet/strategies/MorphoV2Strategy/shared/Shared.t.sol";

contract Fork_Concrete_MorphoV2Strategy_Deposit_Test is Fork_MorphoV2Strategy_Shared_Test {
    function test_deposit_increasesCheckBalance() public {
        uint256 amount = 1000e6;

        uint256 balBefore = strategy.checkBalance(Mainnet.USDC);
        _depositAsVault(amount);
        uint256 balAfter = strategy.checkBalance(Mainnet.USDC);

        assertGt(balAfter, balBefore);
        assertApproxEqRel(balAfter - balBefore, amount, 1e16); // 1% tolerance
    }

    function test_deposit_emitsDepositEvent() public {
        uint256 amount = 1000e6;

        deal(Mainnet.USDC, address(strategy), amount);

        vm.prank(address(ousdVault));
        vm.expectEmit(true, false, false, true, address(strategy));
        emit IMorphoV2Strategy.Deposit(Mainnet.USDC, Mainnet.MorphoOUSDv2Vault, amount);
        strategy.deposit(Mainnet.USDC, amount);
    }

    function test_deposit_receivesShareTokens() public {
        uint256 amount = 1000e6;

        uint256 sharesBefore = IERC20(Mainnet.MorphoOUSDv2Vault).balanceOf(address(strategy));
        _depositAsVault(amount);
        uint256 sharesAfter = IERC20(Mainnet.MorphoOUSDv2Vault).balanceOf(address(strategy));

        assertGt(sharesAfter, sharesBefore);
    }

    function test_depositAll_depositsEntireBalance() public {
        uint256 amount = 1000e6;
        deal(Mainnet.USDC, address(strategy), amount);

        vm.prank(address(ousdVault));
        strategy.depositAll();

        assertEq(IERC20(Mainnet.USDC).balanceOf(address(strategy)), 0);
    }

    function test_deposit_RevertWhen_calledByNonVault() public {
        uint256 amount = 1000e6;
        deal(Mainnet.USDC, address(strategy), amount);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        strategy.deposit(Mainnet.USDC, amount);
    }
}
