// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Unit_Concrete_SonicStakingStrategy_Initialize_Test is Unit_SonicStakingStrategy_Shared_Test {
    function test_initialize_setsAssets() public view {
        // After initialization, assetsMapped should include mockWrappedSonic
        assertTrue(sonicStakingStrategy.supportsAsset(address(mockWrappedSonic)));
    }

    function test_initialize_RevertWhen_doubleInit() public {
        vm.prank(governor);
        vm.expectRevert("Initializable: contract is already initialized");
        sonicStakingStrategy.initialize();
    }
}
