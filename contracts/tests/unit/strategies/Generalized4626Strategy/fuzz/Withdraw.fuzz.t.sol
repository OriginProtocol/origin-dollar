// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_Generalized4626Strategy_Shared_Test
} from "tests/unit/strategies/Generalized4626Strategy/shared/Shared.t.sol";

contract Unit_Fuzz_Generalized4626Strategy_Withdraw_Test is Unit_Generalized4626Strategy_Shared_Test {
    function testFuzz_withdraw_correctAmount(uint128 depositAmount, uint128 withdrawAmount) public {
        depositAmount = uint128(bound(uint256(depositAmount), 1, type(uint128).max));
        withdrawAmount = uint128(bound(uint256(withdrawAmount), 1, uint256(depositAmount)));

        _depositAsVault(uint256(depositAmount));

        vm.prank(address(ousdVault));
        strategy.withdraw(alice, address(asset), uint256(withdrawAmount));

        assertEq(asset.balanceOf(alice), uint256(withdrawAmount));
    }
}
