// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_SonicStakingStrategy_Shared_Test} from "../shared/Shared.t.sol";
import {Sonic} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_SonicStakingStrategy_ViewFunctions_Test is Smoke_SonicStakingStrategy_Shared_Test {
    function test_wrappedSonic_matchesExpected() public view {
        assertEq(sonicStakingStrategy.wrappedSonic(), Sonic.wS, "wrappedSonic should match Sonic.wS");
    }

    function test_sfc_matchesExpected() public view {
        assertEq(address(sonicStakingStrategy.sfc()), Sonic.SFC, "sfc should match Sonic.SFC");
    }

    function test_supportsAsset_wrappedSonic() public view {
        assertTrue(sonicStakingStrategy.supportsAsset(Sonic.wS), "Should support wS");
    }

    function test_supportsAsset_nonWS() public view {
        assertFalse(sonicStakingStrategy.supportsAsset(address(1)), "Should not support random address");
    }

    function test_checkBalance_isNonZero() public view {
        uint256 balance = sonicStakingStrategy.checkBalance(address(wrappedSonic));
        assertGt(balance, 0, "checkBalance should be non-zero for deployed strategy");
    }

    function test_vaultAddress_matchesExpected() public view {
        assertEq(sonicStakingStrategy.vaultAddress(), address(oSonicVault), "vaultAddress should match oSonicVault");
    }

    function test_platformAddress_matchesSFC() public view {
        assertEq(sonicStakingStrategy.platformAddress(), Sonic.SFC, "platformAddress should match SFC");
    }

    function test_governor_isNonZero() public view {
        assertNotEq(sonicStakingStrategy.governor(), address(0), "governor should be non-zero");
    }

    function test_supportedValidators_isNonEmpty() public view {
        assertGt(sonicStakingStrategy.supportedValidatorsLength(), 0, "supportedValidators should be non-empty");
    }

    function test_defaultValidatorId_isSupported() public view {
        uint256 defaultId = sonicStakingStrategy.defaultValidatorId();
        assertGt(defaultId, 0, "defaultValidatorId should be non-zero");

        // Verify it is in the supported list
        uint256 len = sonicStakingStrategy.supportedValidatorsLength();
        bool found = false;
        for (uint256 i = 0; i < len; i++) {
            if (sonicStakingStrategy.supportedValidators(i) == defaultId) {
                found = true;
                break;
            }
        }
        assertTrue(found, "defaultValidatorId should be in supportedValidators");
    }
}
