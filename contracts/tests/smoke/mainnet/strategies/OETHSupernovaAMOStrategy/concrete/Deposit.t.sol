// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_OETHSupernovaAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_OETHSupernovaAMOStrategy_Deposit_Test is Smoke_OETHSupernovaAMOStrategy_Shared_Test {
    function test_deposit_increasesCheckBalance() public {
        uint256 balanceBefore = oethSupernovaAMOStrategy.checkBalance(address(wrappedEther));
        _depositToStrategy(5 ether);
        uint256 balanceAfter = oethSupernovaAMOStrategy.checkBalance(address(wrappedEther));
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase after deposit");
    }

    function test_deposit_viaDepositAll() public {
        uint256 balanceBefore = oethSupernovaAMOStrategy.checkBalance(address(wrappedEther));
        deal(address(wrappedEther), address(oethSupernovaAMOStrategy), 5 ether);
        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.depositAll();
        uint256 balanceAfter = oethSupernovaAMOStrategy.checkBalance(address(wrappedEther));
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase after depositAll");
    }
}
