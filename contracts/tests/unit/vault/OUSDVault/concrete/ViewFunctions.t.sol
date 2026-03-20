// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Shared_Test} from "tests/unit/vault/OUSDVault/shared/Shared.t.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";

contract Unit_Concrete_OUSDVault_ViewFunctions_Test is Unit_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- TOTALVALUE()
    //////////////////////////////////////////////////////

    function test_totalValue_afterInitialMints() public view {
        // Matt and Josh each minted 100 OUSD = 200 USDC in vault
        assertEq(ousdVault.totalValue(), 200e18, "Total value mismatch after initial mints");
    }

    function test_totalValue_afterAdditionalMint() public {
        _mintOUSD(alice, 50e6);
        assertEq(ousdVault.totalValue(), 250e18, "Total value mismatch after additional mint");
    }

    function test_totalValue_withStrategy() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        // Deposit 50 USDC to strategy
        vm.prank(governor);
        ousdVault.depositToStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(50e6)));

        // Total value should remain the same (asset moved from vault to strategy)
        assertEq(ousdVault.totalValue(), 200e18, "Total value should not change with strategy deposit");
    }

    function test_totalValue_withWithdrawalQueue() public {
        // Request withdrawal of 50 OUSD
        vm.prank(matt);
        ousdVault.requestWithdrawal(50e18);

        // Total value decreases by the withdrawal amount
        assertEq(ousdVault.totalValue(), 150e18, "Total value should decrease after withdrawal request");
    }

    //////////////////////////////////////////////////////
    /// --- CHECKBALANCE()
    //////////////////////////////////////////////////////

    function test_checkBalance_ofSupportedAsset() public view {
        assertEq(ousdVault.checkBalance(address(usdc)), 200e6, "USDC balance mismatch");
    }

    function test_checkBalance_ofUnsupportedAsset() public view {
        assertEq(ousdVault.checkBalance(address(ousd)), 0, "Unsupported asset should return 0");
    }

    function test_checkBalance_withStrategy() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        ousdVault.depositToStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(80e6)));

        // Balance includes both vault and strategy holdings minus withdrawal queue
        assertEq(ousdVault.checkBalance(address(usdc)), 200e6, "Check balance should include strategy");
    }

    function test_checkBalance_withWithdrawalQueue() public {
        vm.prank(josh);
        ousdVault.requestWithdrawal(30e18);

        assertEq(ousdVault.checkBalance(address(usdc)), 170e6, "Check balance should exclude queued withdrawals");
    }

    //////////////////////////////////////////////////////
    /// --- GETASSETCOUNT()
    //////////////////////////////////////////////////////

    function test_getAssetCount() public view {
        assertEq(ousdVault.getAssetCount(), 1, "Asset count should be 1");
    }

    //////////////////////////////////////////////////////
    /// --- GETALLASSETS()
    //////////////////////////////////////////////////////

    function test_getAllAssets() public view {
        address[] memory assets = ousdVault.getAllAssets();
        assertEq(assets.length, 1, "Should have 1 asset");
        assertEq(assets[0], address(usdc), "Asset should be USDC");
    }

    //////////////////////////////////////////////////////
    /// --- GETSTRATEGYCOUNT()
    //////////////////////////////////////////////////////

    function test_getStrategyCount_noStrategies() public view {
        assertEq(ousdVault.getStrategyCount(), 0, "Strategy count should be 0");
    }

    function test_getStrategyCount_afterApproval() public {
        _deployAndApproveStrategy();
        assertEq(ousdVault.getStrategyCount(), 1, "Strategy count should be 1");
    }

    //////////////////////////////////////////////////////
    /// --- GETALLSTRATEGIES()
    //////////////////////////////////////////////////////

    function test_getAllStrategies_empty() public view {
        address[] memory strats = ousdVault.getAllStrategies();
        assertEq(strats.length, 0, "Should have 0 strategies");
    }

    function test_getAllStrategies_afterApproval() public {
        MockStrategy strategy = _deployAndApproveStrategy();
        address[] memory strats = ousdVault.getAllStrategies();
        assertEq(strats.length, 1, "Should have 1 strategy");
        assertEq(strats[0], address(strategy), "Strategy address mismatch");
    }

    //////////////////////////////////////////////////////
    /// --- ISSUPPORTEDASSET()
    //////////////////////////////////////////////////////

    function test_isSupportedAsset_true() public view {
        assertTrue(ousdVault.isSupportedAsset(address(usdc)), "USDC should be supported");
    }

    function test_isSupportedAsset_false() public view {
        assertFalse(ousdVault.isSupportedAsset(address(ousd)), "OUSD should not be supported");
    }

    function test_isSupportedAsset_falseForZeroAddress() public view {
        assertFalse(ousdVault.isSupportedAsset(address(0)), "Zero address should not be supported");
    }

    //////////////////////////////////////////////////////
    /// --- OUSD() — DEPRECATED ACCESSOR
    //////////////////////////////////////////////////////

    function test_oUSD_returnsOToken() public view {
        assertEq(address(ousdVault.oUSD()), address(ousd), "oUSD() should return OUSD token");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _toArray(address a) internal pure returns (address[] memory arr) {
        arr = new address[](1);
        arr[0] = a;
    }

    function _toArray(uint256 a) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](1);
        arr[0] = a;
    }
}
