// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.sol";

contract Unit_Concrete_PoolBoosterFactoryMerkl_ComputeAddress_Test is Unit_Merkl_Shared_Test {
    function test_computeAddress_deterministic() public view {
        address computed1 = factoryMerkl.computePoolBoosterAddress(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 1
        );
        address computed2 = factoryMerkl.computePoolBoosterAddress(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 1
        );
        assertEq(computed1, computed2);
    }

    function test_computeAddress_differentSalt() public view {
        address computed1 = factoryMerkl.computePoolBoosterAddress(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 1
        );
        address computed2 = factoryMerkl.computePoolBoosterAddress(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 2
        );
        assertTrue(computed1 != computed2);
    }

    function test_computeAddress_RevertWhen_zeroPool() public {
        vm.expectRevert("Invalid ammPoolAddress address");
        factoryMerkl.computePoolBoosterAddress(
            DEFAULT_CAMPAIGN_TYPE, address(0), DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 1
        );
    }

    function test_computeAddress_RevertWhen_zeroSalt() public {
        vm.expectRevert("Invalid salt");
        factoryMerkl.computePoolBoosterAddress(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, DEFAULT_CAMPAIGN_DATA, 0
        );
    }

    function test_computeAddress_RevertWhen_invalidDuration() public {
        vm.expectRevert("Invalid campaign duration");
        factoryMerkl.computePoolBoosterAddress(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, 3600, DEFAULT_CAMPAIGN_DATA, 1
        );
    }

    function test_computeAddress_RevertWhen_emptyData() public {
        vm.expectRevert("Invalid campaign data");
        factoryMerkl.computePoolBoosterAddress(
            DEFAULT_CAMPAIGN_TYPE, mockAmmPool, DEFAULT_CAMPAIGN_DURATION, "", 1
        );
    }
}
