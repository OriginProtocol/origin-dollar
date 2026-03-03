// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OETHVault_Shared_Test} from "tests/unit/vault/OETHVault/shared/Shared.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";

contract Unit_Concrete_OETHVault_ViewFunctions_Test is Unit_OETHVault_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- GETASSETCOUNT
    //////////////////////////////////////////////////////

    function test_getAssetCount() public view {
        assertEq(oethVault.getAssetCount(), 1);
    }

    //////////////////////////////////////////////////////
    /// --- GETALLASSETS
    //////////////////////////////////////////////////////

    function test_getAllAssets() public view {
        address[] memory assets = oethVault.getAllAssets();
        assertEq(assets.length, 1);
        assertEq(assets[0], address(weth));
    }

    //////////////////////////////////////////////////////
    /// --- GETSTRATEGYCOUNT
    //////////////////////////////////////////////////////

    function test_getStrategyCount_empty() public view {
        assertEq(oethVault.getStrategyCount(), 0);
    }

    function test_getStrategyCount_afterApproval() public {
        _deployAndApproveStrategy();
        assertEq(oethVault.getStrategyCount(), 1);
    }

    function test_getStrategyCount_afterMultipleApprovals() public {
        _deployAndApproveStrategy();
        _deployAndApproveStrategy();
        assertEq(oethVault.getStrategyCount(), 2);
    }

    //////////////////////////////////////////////////////
    /// --- ISSUPPORTEDASSET
    //////////////////////////////////////////////////////

    function test_isSupportedAsset_true() public view {
        assertTrue(oethVault.isSupportedAsset(address(weth)));
    }

    function test_isSupportedAsset_false() public view {
        assertFalse(oethVault.isSupportedAsset(address(oeth)));
    }

    function test_isSupportedAsset_zeroAddress() public view {
        assertFalse(oethVault.isSupportedAsset(address(0)));
    }

    //////////////////////////////////////////////////////
    /// --- CHECKBALANCE
    //////////////////////////////////////////////////////

    function test_checkBalance_forAsset() public view {
        // 200 WETH in vault, no queue, no strategies
        assertEq(oethVault.checkBalance(address(weth)), 200e18);
    }

    function test_checkBalance_forNonAsset() public view {
        assertEq(oethVault.checkBalance(address(oeth)), 0);
    }

    function test_checkBalance_withStrategy() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(80e18)));

        // 120 in vault + 80 in strategy = 200 total
        assertEq(oethVault.checkBalance(address(weth)), 200e18);
    }

    function test_checkBalance_withQueueReservation() public {
        vm.prank(matt);
        oethVault.requestWithdrawal(50e18);

        // 200 WETH total - 50 reserved = 150
        assertEq(oethVault.checkBalance(address(weth)), 150e18);
    }

    //////////////////////////////////////////////////////
    /// --- TOTALVALUE
    //////////////////////////////////////////////////////

    function test_totalValue_afterMint() public view {
        assertEq(oethVault.totalValue(), 200e18);
    }

    function test_totalValue_afterWithdrawalRequest() public {
        vm.prank(matt);
        oethVault.requestWithdrawal(50e18);

        // Total value decreases by the withdrawal amount
        assertEq(oethVault.totalValue(), 150e18);
    }

    function test_totalValue_withStrategy() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        oethVault.depositToStrategy(address(strategy), _toArray(address(weth)), _toArray(uint256(100e18)));

        // Total value includes strategy balance
        assertEq(oethVault.totalValue(), 200e18);
    }

    //////////////////////////////////////////////////////
    /// --- OUSD() DEPRECATED GETTER
    //////////////////////////////////////////////////////

    function test_oUSD_returnsOToken() public view {
        // oUSD() should return the same as oToken()
        assertEq(address(oethVault.oUSD()), address(oethVault.oToken()));
    }

    //////////////////////////////////////////////////////
    /// --- WITHDRAWALQUEUEMETADATA
    //////////////////////////////////////////////////////

    function test_withdrawalQueueMetadata_initial() public view {
        (uint128 queued, uint128 claimable, uint128 claimed, uint128 nextIdx) = oethVault.withdrawalQueueMetadata();
        assertEq(queued, 0);
        assertEq(claimable, 0);
        assertEq(claimed, 0);
        assertEq(nextIdx, 0);
    }

    //////////////////////////////////////////////////////
    /// --- WITHDRAWALREQUESTS
    //////////////////////////////////////////////////////

    function test_withdrawalRequests_data() public {
        vm.prank(matt);
        oethVault.requestWithdrawal(50e18);

        (address withdrawer, bool claimed, uint40 timestamp, uint128 amount, uint128 queued) =
            oethVault.withdrawalRequests(0);

        assertEq(withdrawer, matt);
        assertFalse(claimed);
        assertEq(timestamp, block.timestamp);
        assertEq(amount, 50e18);
        assertEq(queued, 50e18);
    }

    //////////////////////////////////////////////////////
    /// --- STRATEGIES MAPPING
    //////////////////////////////////////////////////////

    function test_strategies_mapping() public {
        MockStrategy strategy = _deployAndApproveStrategy();
        (bool isSupported,) = oethVault.strategies(address(strategy));
        assertTrue(isSupported);
    }

    function test_strategies_mapping_unsupported() public view {
        (bool isSupported,) = oethVault.strategies(alice);
        assertFalse(isSupported);
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
