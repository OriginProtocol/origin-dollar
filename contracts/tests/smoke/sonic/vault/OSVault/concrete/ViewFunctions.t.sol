// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OSVault_Shared_Test} from "tests/smoke/sonic/vault/OSVault/shared/Shared.t.sol";

// --- Test utilities
import {Sonic} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_OSVault_ViewFunctions_Test is Smoke_OSVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW_FUNCTIONS
    //////////////////////////////////////////////////////

    function test_governor_isTimelock() public view {
        assertEq(oSonicVault.governor(), Sonic.timelock);
    }

    function test_strategist_isNonZero() public view {
        assertTrue(oSonicVault.strategistAddr() != address(0));
    }

    function test_defaultStrategy_isSet() public view {
        assertEq(oSonicVault.defaultStrategy(), sonicStakingStrategy);
    }

    function test_vaultBuffer_isSet() public view {
        assertEq(oSonicVault.vaultBuffer(), 0.005e18);
    }

    function test_withdrawalClaimDelay_isSet() public view {
        assertGt(oSonicVault.withdrawalClaimDelay(), 0);
    }

    function test_trusteeFeeBps_isSet() public view {
        assertEq(oSonicVault.trusteeFeeBps(), 1000);
    }

    function test_allStrategies_areSupported() public view {
        address[] memory strats = oSonicVault.getAllStrategies();
        for (uint256 i = 0; i < strats.length; i++) {
            assertTrue(oSonicVault.strategies(strats[i]).isSupported);
        }
    }

    function test_totalValue_isNonZero() public view {
        assertGt(oSonicVault.totalValue(), 0);
    }

    function test_checkBalance_isNonZero() public view {
        assertGt(oSonicVault.checkBalance(address(wrappedSonic)), 0);
    }

    function test_capitalAndRebase_notPaused() public view {
        assertFalse(oSonicVault.capitalPaused());
        assertFalse(oSonicVault.rebasePaused());
    }
}
