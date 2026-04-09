// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_OETHVault_Shared_Test} from "tests/smoke/mainnet/vault/OETHVault/shared/Shared.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_OETHVault_ViewFunctions_Test is Smoke_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW_FUNCTIONS
    //////////////////////////////////////////////////////

    function test_governor_isTimelock() public view {
        assertEq(oethVault.governor(), Mainnet.Timelock);
    }

    function test_strategist_isNonZero() public view {
        assertTrue(oethVault.strategistAddr() != address(0));
    }

    function test_defaultStrategy_isSet() public view {
        address defaultStrat = oethVault.defaultStrategy();
        assertNotEq(defaultStrat, address(0));
        // Default strategy is CompoundingStakingSSV, resolved separately
        address compoundingStaking = resolver.resolve("COMPOUNDING_STAKING_SSV_STRATEGY_PROXY");
        assertEq(defaultStrat, compoundingStaking);
    }

    function test_vaultBuffer_isSet() public view {
        assertEq(oethVault.vaultBuffer(), 0.002e18);
    }

    function test_withdrawalClaimDelay_isSet() public view {
        assertGt(oethVault.withdrawalClaimDelay(), 0);
    }

    function test_isMintWhitelistedStrategy_curveAMO() public view {
        assertTrue(oethVault.isMintWhitelistedStrategy(address(curveAMOStrategy)));
    }

    function test_isMintWhitelistedStrategy_supernovaAMO() public view {
        address supernovaAMO = resolver.resolve("OETH_SUPERNOVA_AMO_STRATEGY_PROXY");
        assertTrue(oethVault.isMintWhitelistedStrategy(supernovaAMO));
    }

    function test_allStrategies_areSupported() public view {
        address[] memory strats = oethVault.getAllStrategies();
        for (uint256 i = 0; i < strats.length; i++) {
            bool isSupported = oethVault.strategies(strats[i]).isSupported;
            assertTrue(isSupported);
        }
    }

    function test_totalValue_isNonZero() public view {
        assertGt(oethVault.totalValue(), 0);
    }

    function test_checkBalance_isNonZero() public view {
        assertGt(oethVault.checkBalance(address(weth)), 0);
    }

    function test_capitalAndRebase_notPaused() public view {
        assertFalse(oethVault.capitalPaused());
        assertFalse(oethVault.rebasePaused());
    }
}
