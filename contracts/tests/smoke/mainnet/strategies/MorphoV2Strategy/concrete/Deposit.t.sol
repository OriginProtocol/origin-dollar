// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_MorphoV2Strategy_Shared_Test} from "../shared/Shared.t.sol";

contract Smoke_Concrete_MorphoV2Strategy_Deposit_Test is Smoke_MorphoV2Strategy_Shared_Test {
    function test_deposit_increasesCheckBalance() public {
        uint256 balanceBefore = morphoV2Strategy.checkBalance(address(usdc));
        _depositToStrategy(1_000e6);
        uint256 balanceAfter = morphoV2Strategy.checkBalance(address(usdc));
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase after deposit");
    }

    function test_depositAll_depositsEntireBalance() public {
        deal(address(usdc), address(morphoV2Strategy), 5_000e6);
        vm.prank(address(ousdVault));
        morphoV2Strategy.depositAll();
        assertEq(usdc.balanceOf(address(morphoV2Strategy)), 0, "USDC balance should be 0 after depositAll");
    }
}
