// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_MerklPoolBoosterBribesModule_Shared_Test
} from "tests/unit/automation/MerklPoolBoosterBribesModule/shared/Shared.t.sol";
import {IMerklPoolBoosterBribesModule} from "contracts/interfaces/automation/IMerklPoolBoosterBribesModule.sol";

contract Unit_Concrete_MerklPoolBoosterBribesModule_SetFactory_Test is Unit_MerklPoolBoosterBribesModule_Shared_Test {
    function test_setFactory_updatesFactoryAndEmitsEvent() public {
        address newFactory = makeAddr("NewFactory");

        vm.prank(address(mockSafe));
        vm.expectEmit(true, true, true, true);
        emit IMerklPoolBoosterBribesModule.FactoryUpdated(newFactory);
        module.setFactory(newFactory);

        assertEq(module.factory(), newFactory);
    }

    function test_setFactory_RevertWhen_notSafe() public {
        vm.prank(operator);
        vm.expectRevert("Caller is not the safe contract");
        module.setFactory(makeAddr("NewFactory"));
    }

    function test_setFactory_RevertWhen_zeroFactory() public {
        vm.prank(address(mockSafe));
        vm.expectRevert("Zero address");
        module.setFactory(address(0));
    }
}
