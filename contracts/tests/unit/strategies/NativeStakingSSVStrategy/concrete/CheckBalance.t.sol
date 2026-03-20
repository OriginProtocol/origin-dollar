// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_NativeStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_NativeStakingSSVStrategy_CheckBalance_Test is Unit_NativeStakingSSVStrategy_Shared_Test {
    function test_checkBalance_zeroValidatorsZeroWeth() public view {
        assertEq(nativeStakingSSVStrategy.checkBalance(address(mockWeth)), 0);
    }

    function test_checkBalance_withValidators() public {
        _setActiveDepositedValidators(5);
        assertEq(nativeStakingSSVStrategy.checkBalance(address(mockWeth)), 5 * 32 ether);
    }

    function test_checkBalance_withWeth() public {
        _depositAsVault(10 ether);
        assertEq(nativeStakingSSVStrategy.checkBalance(address(mockWeth)), 10 ether);
    }

    function test_checkBalance_withValidatorsAndWeth() public {
        _setActiveDepositedValidators(3);
        _depositAsVault(10 ether);
        assertEq(nativeStakingSSVStrategy.checkBalance(address(mockWeth)), 3 * 32 ether + 10 ether);
    }

    function test_checkBalance_RevertWhen_unsupportedAsset() public {
        vm.expectRevert("Unsupported asset");
        nativeStakingSSVStrategy.checkBalance(address(oeth));
    }
}
