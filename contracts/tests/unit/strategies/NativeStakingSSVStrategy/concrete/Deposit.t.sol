// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_NativeStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_NativeStakingSSVStrategy_Deposit_Test is Unit_NativeStakingSSVStrategy_Shared_Test {
    function test_deposit() public {
        uint256 amount = 32 ether;
        deal(address(mockWeth), address(nativeStakingSSVStrategy), amount);

        vm.prank(address(oethVault));
        vm.expectEmit(true, true, true, true);
        emit InitializableAbstractStrategy.Deposit(address(mockWeth), address(0), amount);
        nativeStakingSSVStrategy.deposit(address(mockWeth), amount);

        assertEq(nativeStakingSSVStrategy.depositedWethAccountedFor(), amount);
    }

    function test_deposit_RevertWhen_wrongAsset() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Unsupported asset");
        nativeStakingSSVStrategy.deposit(address(oeth), 1 ether);
    }

    function test_deposit_RevertWhen_zeroAmount() public {
        vm.prank(address(oethVault));
        vm.expectRevert("Must deposit something");
        nativeStakingSSVStrategy.deposit(address(mockWeth), 0);
    }

    function test_deposit_RevertWhen_callerNotVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        nativeStakingSSVStrategy.deposit(address(mockWeth), 1 ether);
    }

    function test_depositAll() public {
        // Transfer WETH to strategy without calling deposit
        vm.prank(josh);
        weth.transfer(address(nativeStakingSSVStrategy), 10 ether);

        vm.prank(address(oethVault));
        vm.expectEmit(true, true, true, true);
        emit InitializableAbstractStrategy.Deposit(address(mockWeth), address(0), 10 ether);
        nativeStakingSSVStrategy.depositAll();

        assertEq(nativeStakingSSVStrategy.depositedWethAccountedFor(), 10 ether);
    }

    function test_depositAll_noNewWeth() public {
        // First deposit to set accounting
        _depositAsVault(10 ether);

        // depositAll with no new WETH should be a no-op
        vm.prank(address(oethVault));
        nativeStakingSSVStrategy.depositAll();

        assertEq(nativeStakingSSVStrategy.depositedWethAccountedFor(), 10 ether);
    }

    function test_depositAll_RevertWhen_callerNotVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        nativeStakingSSVStrategy.depositAll();
    }
}
