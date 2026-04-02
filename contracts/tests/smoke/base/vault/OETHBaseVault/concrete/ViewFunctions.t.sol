// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base as BaseAddresses} from "tests/utils/Addresses.sol";
import {Smoke_OETHBaseVault_Shared_Test} from "tests/smoke/base/vault/OETHBaseVault/shared/Shared.t.sol";

contract Smoke_Concrete_OETHBaseVault_ViewFunctions_Test is Smoke_OETHBaseVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW_FUNCTIONS
    //////////////////////////////////////////////////////

    function test_governor_isTimelock() public view {
        assertEq(oethBaseVault.governor(), BaseAddresses.timelock);
    }

    function test_strategist_isNonZero() public view {
        assertTrue(oethBaseVault.strategistAddr() != address(0));
    }

    function test_defaultStrategy_isSet() public view {
        assertEq(oethBaseVault.defaultStrategy(), address(aerodromeAMOStrategy));
    }

    function test_withdrawalClaimDelay_isSet() public view {
        assertGt(oethBaseVault.withdrawalClaimDelay(), 0);
    }

    function test_allStrategies_areSupported() public view {
        address[] memory strats = oethBaseVault.getAllStrategies();
        for (uint256 i = 0; i < strats.length; i++) {
            assertTrue(oethBaseVault.strategies(strats[i]).isSupported);
        }
    }

    function test_totalValue_isNonZero() public view {
        assertGt(oethBaseVault.totalValue(), 0);
    }

    function test_checkBalance_isNonZero() public view {
        assertGt(oethBaseVault.checkBalance(address(weth)), 0);
    }

    function test_capitalAndRebase_notPaused() public view {
        assertFalse(oethBaseVault.capitalPaused());
        assertFalse(oethBaseVault.rebasePaused());
    }
}
