// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_NativeStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_NativeStakingSSVStrategy_Withdraw_Test is Unit_NativeStakingSSVStrategy_Shared_Test {
    function test_withdraw() public {
        _depositAsVault(10 ether);

        uint256 vaultBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        vm.expectEmit(true, true, true, true);
        emit InitializableAbstractStrategy.Withdrawal(address(mockWeth), address(0), 5 ether);
        nativeStakingSSVStrategy.withdraw(address(oethVault), address(mockWeth), 5 ether);

        assertEq(weth.balanceOf(address(oethVault)) - vaultBefore, 5 ether);
    }

    function test_withdraw_RevertWhen_wrongAsset() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Unsupported asset");
        nativeStakingSSVStrategy.withdraw(address(oethVault), address(oeth), 1 ether);
    }

    function test_withdraw_RevertWhen_zeroAmount() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Must withdraw something");
        nativeStakingSSVStrategy.withdraw(address(oethVault), address(mockWeth), 0);
    }

    function test_withdraw_RevertWhen_callerNotVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        nativeStakingSSVStrategy.withdraw(address(oethVault), address(mockWeth), 1 ether);
    }

    function test_withdrawAll() public {
        _depositAsVault(10 ether);

        uint256 vaultBefore = weth.balanceOf(address(oethVault));

        vm.prank(address(oethVault));
        nativeStakingSSVStrategy.withdrawAll();

        assertEq(weth.balanceOf(address(oethVault)) - vaultBefore, 10 ether);
    }

    function test_withdrawAll_noWeth() public {
        // withdrawAll with no WETH should be a no-op
        vm.prank(address(oethVault));
        nativeStakingSSVStrategy.withdrawAll();
    }

    function test_withdrawAll_RevertWhen_callerNotVaultOrGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault or Governor");
        nativeStakingSSVStrategy.withdrawAll();
    }
}
