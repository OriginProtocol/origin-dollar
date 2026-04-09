// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_OETHVault_Shared_Test} from "tests/unit/vault/OETHVault/shared/Shared.t.sol";

// --- Project imports
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";

contract Unit_Concrete_OETHVault_Config_Test is Unit_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- GETALLSTRATEGIES
    //////////////////////////////////////////////////////

    function test_getAllStrategies_empty() public view {
        address[] memory strategies = oethVault.getAllStrategies();
        assertEq(strategies.length, 0, "Should have no strategies initially");
    }

    function test_getAllStrategies_afterApproval() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        address[] memory strategies = oethVault.getAllStrategies();
        assertEq(strategies.length, 1, "Should have 1 strategy");
        assertEq(strategies[0], address(strategy), "Strategy address mismatch");
    }

    //////////////////////////////////////////////////////
    /// --- REMOVESTRATEGY
    //////////////////////////////////////////////////////

    function test_removeStrategy_resetsMintWhitelist() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.addStrategyToMintWhitelist(address(strategy));

        assertTrue(oethVault.isMintWhitelistedStrategy(address(strategy)));

        vm.prank(governor);
        oethVault.removeStrategy(address(strategy));

        assertFalse(oethVault.isMintWhitelistedStrategy(address(strategy)));
    }
}
