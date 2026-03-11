// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_CurveAMOStrategy_Shared_Test} from
    "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_CurveAMOStrategy_DepositAll_Test is Unit_CurveAMOStrategy_Shared_Test {
    function test_depositAll_depositsEntireBalance() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        deal(address(weth), address(curveAMOStrategy), amount);

        vm.prank(address(oethVault));
        curveAMOStrategy.depositAll();

        assertEq(weth.balanceOf(address(curveAMOStrategy)), 0);
        assertGt(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_depositAll_noOpWhenZeroBalance() public {
        vm.prank(address(oethVault));
        curveAMOStrategy.depositAll();

        assertEq(curveGauge.balanceOf(address(curveAMOStrategy)), 0);
    }

    function test_depositAll_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        curveAMOStrategy.depositAll();
    }
}
