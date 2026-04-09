// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_SonicSwapXAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_SonicSwapXAMOStrategy_Deposit_Test is Smoke_SonicSwapXAMOStrategy_Shared_Test {
    function test_deposit_increasesCheckBalance() public {
        uint256 balanceBefore = sonicSwapXAMOStrategy.checkBalance(address(wrappedSonic));
        _depositToStrategy(5 ether);
        uint256 balanceAfter = sonicSwapXAMOStrategy.checkBalance(address(wrappedSonic));
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase after deposit");
    }

    function test_deposit_viaDepositAll() public {
        uint256 balanceBefore = sonicSwapXAMOStrategy.checkBalance(address(wrappedSonic));
        deal(address(wrappedSonic), address(sonicSwapXAMOStrategy), 5 ether);
        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.depositAll();
        uint256 balanceAfter = sonicSwapXAMOStrategy.checkBalance(address(wrappedSonic));
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase after depositAll");
    }
}
