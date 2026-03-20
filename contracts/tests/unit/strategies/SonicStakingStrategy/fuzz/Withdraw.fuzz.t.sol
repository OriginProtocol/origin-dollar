// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Unit_Fuzz_SonicStakingStrategy_Withdraw_Test is Unit_SonicStakingStrategy_Shared_Test {
    function testFuzz_withdraw_transfersExactAmount(uint256 amount) public {
        amount = bound(amount, 1e15, 100_000 ether);

        // Deal wS directly to strategy
        _mintWS(address(sonicStakingStrategy), amount);

        vm.prank(address(oSonicVault));
        sonicStakingStrategy.withdraw(alice, address(mockWrappedSonic), amount);

        assertEq(mockWrappedSonic.balanceOf(alice), amount, "Recipient should receive exact amount");
        assertEq(mockWrappedSonic.balanceOf(address(sonicStakingStrategy)), 0, "Strategy should have 0 wS");
    }
}
