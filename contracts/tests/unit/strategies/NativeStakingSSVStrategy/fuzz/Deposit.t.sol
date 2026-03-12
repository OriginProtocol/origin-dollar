// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_NativeStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_NativeStakingSSVStrategy_Deposit_Test is Unit_NativeStakingSSVStrategy_Shared_Test {
    /// @dev Fuzz deposit amounts
    function testFuzz_deposit(uint256 amount) public {
        amount = bound(amount, 1, 10_000 ether);

        deal(address(mockWeth), address(nativeStakingSSVStrategy), amount);

        vm.prank(address(oethVault));
        nativeStakingSSVStrategy.deposit(address(mockWeth), amount);

        assertEq(nativeStakingSSVStrategy.depositedWethAccountedFor(), amount);
    }

    /// @dev Fuzz checkBalance with varying validators and WETH
    function testFuzz_checkBalance(uint16 validators, uint256 wethAmount) public {
        validators = uint16(bound(validators, 0, 256));
        wethAmount = bound(wethAmount, 0, 10_000 ether);

        _setActiveDepositedValidators(validators);
        if (wethAmount > 0) {
            deal(address(mockWeth), address(nativeStakingSSVStrategy), wethAmount);
        }

        uint256 expected = uint256(validators) * 32 ether + wethAmount;
        assertEq(nativeStakingSSVStrategy.checkBalance(address(mockWeth)), expected);
    }
}
