// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_SonicStakingStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_SonicStakingStrategy_Deposit_Test is Smoke_SonicStakingStrategy_Shared_Test {
    function test_deposit_increasesCheckBalance() public {
        uint256 balanceBefore = sonicStakingStrategy.checkBalance(address(wrappedSonic));

        _depositToStrategy(15_000 ether);

        uint256 balanceAfter = sonicStakingStrategy.checkBalance(address(wrappedSonic));
        assertEq(balanceAfter, balanceBefore + 15_000 ether, "checkBalance should increase by deposit amount");
    }

    function test_deposit_viaDepositAll() public {
        uint256 amount = 15_000 ether;
        uint256 balanceBefore = sonicStakingStrategy.checkBalance(address(wrappedSonic));

        deal(address(wrappedSonic), address(sonicStakingStrategy), amount);
        vm.prank(address(oSonicVault));
        sonicStakingStrategy.depositAll();

        uint256 balanceAfter = sonicStakingStrategy.checkBalance(address(wrappedSonic));
        assertEq(balanceAfter, balanceBefore + amount, "checkBalance should increase by deposit amount");
    }
}
