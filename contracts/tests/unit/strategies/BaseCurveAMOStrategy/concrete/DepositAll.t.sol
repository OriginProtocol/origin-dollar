// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BaseCurveAMOStrategy_Shared_Test} from "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_BaseCurveAMOStrategy_DepositAll_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    function test_depositAll_depositsEntireBalance() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        deal(address(weth), address(baseCurveAMOStrategy), amount);

        vm.prank(address(oethVault));
        baseCurveAMOStrategy.depositAll();

        assertEq(weth.balanceOf(address(baseCurveAMOStrategy)), 0);
        assertGt(curveGauge.balanceOf(address(baseCurveAMOStrategy)), 0);
    }

    function test_depositAll_noOpWhenZeroBalance() public {
        vm.prank(address(oethVault));
        baseCurveAMOStrategy.depositAll();

        assertEq(curveGauge.balanceOf(address(baseCurveAMOStrategy)), 0);
    }

    function test_depositAll_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        baseCurveAMOStrategy.depositAll();
    }
}
