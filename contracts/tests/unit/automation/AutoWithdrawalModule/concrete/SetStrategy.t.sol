// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_AutoWithdrawalModule_Shared_Test} from
    "tests/unit/automation/AutoWithdrawalModule/shared/Shared.t.sol";

import {AutoWithdrawalModule} from "contracts/automation/AutoWithdrawalModule.sol";

contract Unit_Concrete_AutoWithdrawalModule_SetStrategy_Test is Unit_AutoWithdrawalModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_setStrategy_updatesStrategy() public {
        address newStrategy = makeAddr("NewStrategy");

        vm.prank(address(mockSafe));
        autoWithdrawalModule.setStrategy(newStrategy);

        assertEq(autoWithdrawalModule.strategy(), newStrategy);
    }

    function test_setStrategy_emitsStrategyUpdated() public {
        address newStrategy = makeAddr("NewStrategy");

        vm.expectEmit(false, false, false, true, address(autoWithdrawalModule));
        emit AutoWithdrawalModule.StrategyUpdated(address(mockStrategy), newStrategy);

        vm.prank(address(mockSafe));
        autoWithdrawalModule.setStrategy(newStrategy);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_setStrategy_RevertWhen_notSafe() public {
        vm.expectRevert("Caller is not the safe contract");
        vm.prank(josh);
        autoWithdrawalModule.setStrategy(makeAddr("NewStrategy"));
    }

    function test_setStrategy_RevertWhen_zeroAddress() public {
        vm.expectRevert("Invalid strategy");
        vm.prank(address(mockSafe));
        autoWithdrawalModule.setStrategy(address(0));
    }
}
