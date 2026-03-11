// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BridgedWOETHStrategy_Shared_Test} from "tests/unit/strategies/BridgedWOETHStrategy/shared/Shared.t.sol";

contract Unit_Concrete_BridgedWOETHStrategy_DisabledFunctions_Test is Unit_BridgedWOETHStrategy_Shared_Test {
    function test_deposit_RevertWhen_called() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Deposit disabled");
        bridgedWOETHStrategy.deposit(address(mockWeth), 1e18);
    }

    function test_depositAll_RevertWhen_called() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Deposit disabled");
        bridgedWOETHStrategy.depositAll();
    }

    function test_withdraw_RevertWhen_called() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Withdrawal disabled");
        bridgedWOETHStrategy.withdraw(alice, address(mockWeth), 1e18);
    }

    function test_withdrawAll_noOp() public {
        // withdrawAll succeeds but does nothing
        vm.prank(address(oethVault));
        bridgedWOETHStrategy.withdrawAll();
    }

    function test_setPTokenAddress_RevertWhen_called() public {
        vm.prank(governor);
        vm.expectRevert("No pTokens are used");
        bridgedWOETHStrategy.setPTokenAddress(address(0xdead), address(0xbeef));
    }

    function test_removePToken_RevertWhen_called() public {
        vm.prank(governor);
        vm.expectRevert("No pTokens are used");
        bridgedWOETHStrategy.removePToken(0);
    }

    function test_collectRewardTokens_noOp() public {
        bridgedWOETHStrategy.collectRewardTokens();
    }

    function test_safeApproveAllTokens_noOp() public {
        bridgedWOETHStrategy.safeApproveAllTokens();
    }
}
