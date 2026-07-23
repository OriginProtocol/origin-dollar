// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_MerklPoolBoosterBribesModule_Shared_Test
} from "tests/unit/automation/MerklPoolBoosterBribesModule/shared/Shared.t.sol";
import {Automation} from "tests/utils/artifacts/Automation.sol";

contract Unit_Concrete_MerklPoolBoosterBribesModule_Constructor_Test is Unit_MerklPoolBoosterBribesModule_Shared_Test {
    function test_constructor_setsConfigurationAndRoles() public view {
        assertEq(address(module.safeContract()), address(mockSafe));
        assertEq(module.factory(), address(mockFactory));
        assertTrue(module.hasRole(module.DEFAULT_ADMIN_ROLE(), address(mockSafe)));
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), address(mockSafe)));
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), operator));
    }

    function test_constructor_RevertWhen_zeroFactory() public {
        vm.expectRevert("Zero address");
        vm.deployCode(Automation.MERKL_POOL_BOOSTER_BRIBES_MODULE, abi.encode(address(mockSafe), operator, address(0)));
    }
}
