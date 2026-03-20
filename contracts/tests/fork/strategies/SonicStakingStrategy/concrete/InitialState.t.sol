// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_SonicStakingStrategy_Shared_Test} from
    "tests/fork/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Fork_Concrete_SonicStakingStrategy_InitialState_Test is Fork_SonicStakingStrategy_Shared_Test {
    function test_initialState() public view {
        assertEq(
            sonicStakingStrategy.wrappedSonic(),
            address(wrappedSonic),
            "Incorrect wrapped sonic address"
        );
        assertEq(address(sonicStakingStrategy.sfc()), address(sfc), "Incorrect SFC address");
        assertEq(
            sonicStakingStrategy.supportedValidatorsLength(),
            testValidatorIds.length,
            "Incorrect supported validators length"
        );

        for (uint256 i = 0; i < testValidatorIds.length; i++) {
            assertTrue(
                sonicStakingStrategy.isSupportedValidator(testValidatorIds[i]),
                "Validator expected to be supported"
            );
        }

        assertEq(sonicStakingStrategy.platformAddress(), address(sfc), "Incorrect platform address");
        assertEq(sonicStakingStrategy.vaultAddress(), address(oSonicVault), "Incorrect vault address");
        assertEq(sonicStakingStrategy.harvesterAddress(), address(0), "Harvester address not empty");
        assertEq(sonicStakingStrategy.getRewardTokenAddresses().length, 0, "Unexpected reward tokens");
    }
}
