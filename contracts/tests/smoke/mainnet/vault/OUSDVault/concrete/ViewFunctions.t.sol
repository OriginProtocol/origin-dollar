// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Mainnet} from "tests/utils/Addresses.sol";
import {Smoke_OUSDVault_Shared_Test} from "tests/smoke/mainnet/vault/OUSDVault/shared/Shared.t.sol";

contract Smoke_Concrete_OUSDVault_ViewFunctions_Test is Smoke_OUSDVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW_FUNCTIONS
    //////////////////////////////////////////////////////

    function test_governor_isTimelock() public view {
        assertEq(ousdVault.governor(), Mainnet.Timelock);
    }

    function test_strategist_isNonZero() public view {
        assertTrue(ousdVault.strategistAddr() != address(0));
    }

    function test_defaultStrategy_isSet() public view {
        assertEq(ousdVault.defaultStrategy(), address(morphoV2Strategy));
    }

    function test_vaultBuffer_isZero() public view {
        assertEq(ousdVault.vaultBuffer(), 0);
    }

    function test_withdrawalClaimDelay_isSet() public view {
        assertGt(ousdVault.withdrawalClaimDelay(), 0);
    }

    function test_isMintWhitelistedStrategy() public view {
        address curveAMO = resolver.resolve("OUSD_CURVE_AMO_STRATEGY");
        assertTrue(ousdVault.isMintWhitelistedStrategy(curveAMO));
    }

    function test_allStrategies_areSupported() public view {
        address[] memory strats = ousdVault.getAllStrategies();
        for (uint256 i = 0; i < strats.length; i++) {
            bool isSupported = ousdVault.strategies(strats[i]).isSupported;
            assertTrue(isSupported);
        }
    }

    function test_totalValue_isNonZero() public view {
        assertGt(ousdVault.totalValue(), 0);
    }

    function test_checkBalance_isNonZero() public view {
        assertGt(ousdVault.checkBalance(address(usdc)), 0);
    }

    function test_capitalAndRebase_notPaused() public view {
        assertFalse(ousdVault.capitalPaused());
        assertFalse(ousdVault.rebasePaused());
    }
}
