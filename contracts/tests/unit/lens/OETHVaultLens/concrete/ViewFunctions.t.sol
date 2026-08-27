// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OETHVaultLens_Shared_Test} from "../shared/Shared.t.sol";

contract Unit_Concrete_OETHVaultLens_ViewFunctions_Test is Unit_OETHVaultLens_Shared_Test {
    function test_constructor_setsConfiguration() public view {
        assertEq(address(lens.vault()), address(mockVault));
        assertEq(address(lens.oToken()), address(mockOToken));
        assertEq(lens.stakingStrategy(), address(mockStrategy));
        assertEq(lens.MAX_VERIFIED_BALANCE_AGE(), 24 hours);
    }
}
