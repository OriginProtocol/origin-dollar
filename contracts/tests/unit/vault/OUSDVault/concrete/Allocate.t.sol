// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Shared_Test} from "tests/unit/vault/OUSDVault/shared/Shared.t.sol";
import {VaultStorage} from "contracts/vault/VaultStorage.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";

contract Unit_Concrete_OUSDVault_Allocate_Test is Unit_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ALLOCATE()
    //////////////////////////////////////////////////////

    function test_allocate_toDefaultStrategy() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        ousdVault.setDefaultStrategy(address(strategy));

        vm.prank(governor);
        ousdVault.allocate();

        // All 200 USDC should be allocated (no vault buffer set)
        assertEq(usdc.balanceOf(address(strategy)), 200e6, "Strategy should receive USDC");
        assertEq(usdc.balanceOf(address(ousdVault)), 0, "Vault should be empty");
    }

    function test_allocate_respectsVaultBuffer() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        ousdVault.setDefaultStrategy(address(strategy));
        ousdVault.setVaultBuffer(5e17); // 50%
        vm.stopPrank();

        vm.prank(governor);
        ousdVault.allocate();

        // With 50% buffer and 200 OUSD supply: buffer = 100 USDC, allocate = 100 USDC
        assertEq(usdc.balanceOf(address(strategy)), 100e6, "Strategy should receive 100 USDC");
        assertEq(usdc.balanceOf(address(ousdVault)), 100e6, "Vault should retain buffer");
    }

    function test_allocate_doesNothingWithoutStrategy() public {
        vm.prank(governor);
        ousdVault.allocate();

        assertEq(usdc.balanceOf(address(ousdVault)), 200e6, "All USDC should stay in vault");
    }

    function test_allocate_doesNothingWithoutExcessFunds() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        ousdVault.setDefaultStrategy(address(strategy));
        ousdVault.setVaultBuffer(1e18); // 100% buffer
        vm.stopPrank();

        vm.prank(governor);
        ousdVault.allocate();

        // 100% buffer means nothing to allocate
        assertEq(usdc.balanceOf(address(strategy)), 0, "Strategy should receive nothing");
    }

    function test_allocate_reservesUSDCForWithdrawalQueue() public {
        MockStrategy strategy = _deployAndApproveStrategy();
        vm.prank(governor);
        ousdVault.setDefaultStrategy(address(strategy));

        // Request withdrawal of 50 OUSD
        vm.prank(matt);
        ousdVault.requestWithdrawal(50e18);

        vm.prank(governor);
        ousdVault.allocate();

        // 200 USDC total, 50 reserved for queue → 150 USDC to strategy
        assertEq(usdc.balanceOf(address(strategy)), 150e6, "Strategy should receive 150 USDC");
        assertEq(usdc.balanceOf(address(ousdVault)), 50e6, "Vault should retain 50 USDC for queue");
    }

    function test_allocate_emitsAssetAllocated() public {
        MockStrategy strategy = _deployAndApproveStrategy();
        vm.prank(governor);
        ousdVault.setDefaultStrategy(address(strategy));

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit VaultStorage.AssetAllocated(address(usdc), address(strategy), 200e6);
        ousdVault.allocate();
    }

    //////////////////////////////////////////////////////
    /// --- DEPOSITTOSTRATEGY()
    //////////////////////////////////////////////////////

    function test_depositToStrategy_happyPath() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        ousdVault.depositToStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(100e6)));

        assertEq(usdc.balanceOf(address(strategy)), 100e6, "Strategy should receive 100 USDC");
        assertEq(usdc.balanceOf(address(ousdVault)), 100e6, "Vault should retain 100 USDC");
    }

    function test_depositToStrategy_strategist() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(strategist);
        ousdVault.depositToStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(50e6)));

        assertEq(usdc.balanceOf(address(strategy)), 50e6);
    }

    function test_depositToStrategy_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        ousdVault.depositToStrategy(alice, _toArray(address(usdc)), _toArray(uint256(1)));
    }

    function test_depositToStrategy_RevertWhen_unapproved() public {
        MockStrategy fakeStrategy = new MockStrategy();

        vm.prank(governor);
        vm.expectRevert("Invalid to Strategy");
        ousdVault.depositToStrategy(address(fakeStrategy), _toArray(address(usdc)), _toArray(uint256(100e6)));
    }

    function test_depositToStrategy_RevertWhen_wrongAsset() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        vm.expectRevert("Only asset is supported");
        ousdVault.depositToStrategy(address(strategy), _toArray(address(ousd)), _toArray(uint256(100e6)));
    }

    function test_depositToStrategy_RevertWhen_notEnoughAvailable() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        // Request withdrawal of 180 OUSD, leaving only 20 USDC available
        vm.prank(matt);
        ousdVault.requestWithdrawal(100e18);
        vm.prank(josh);
        ousdVault.requestWithdrawal(80e18);

        vm.prank(governor);
        vm.expectRevert("Not enough assets available");
        ousdVault.depositToStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(30e6)));
    }

    //////////////////////////////////////////////////////
    /// --- WITHDRAWFROMSTRATEGY()
    //////////////////////////////////////////////////////

    function test_withdrawFromStrategy_happyPath() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        // First deposit
        vm.prank(governor);
        ousdVault.depositToStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(100e6)));

        // Then withdraw
        vm.prank(governor);
        ousdVault.withdrawFromStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(50e6)));

        assertEq(usdc.balanceOf(address(strategy)), 50e6, "Strategy should have 50 USDC remaining");
        assertEq(usdc.balanceOf(address(ousdVault)), 150e6, "Vault should have 150 USDC");
    }

    function test_withdrawFromStrategy_addsQueueLiquidity() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        // Deposit to strategy
        vm.prank(governor);
        ousdVault.depositToStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(150e6)));

        // Request withdrawal (50 USDC in vault, request 80 OUSD)
        vm.prank(matt);
        ousdVault.requestWithdrawal(80e18);

        (, uint128 claimableBefore,,) = ousdVault.withdrawalQueueMetadata();

        // Withdraw from strategy adds liquidity to queue
        vm.prank(governor);
        ousdVault.withdrawFromStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(100e6)));

        (, uint128 claimableAfter,,) = ousdVault.withdrawalQueueMetadata();
        assertGt(claimableAfter, claimableBefore, "Claimable should increase after strategy withdrawal");
    }

    function test_withdrawFromStrategy_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        ousdVault.withdrawFromStrategy(alice, _toArray(address(usdc)), _toArray(uint256(1)));
    }

    function test_withdrawFromStrategy_RevertWhen_unapproved() public {
        MockStrategy fakeStrategy = new MockStrategy();

        vm.prank(governor);
        vm.expectRevert("Invalid from Strategy");
        ousdVault.withdrawFromStrategy(address(fakeStrategy), _toArray(address(usdc)), _toArray(uint256(100e6)));
    }

    //////////////////////////////////////////////////////
    /// --- WITHDRAWALLFROMSTRATEGY()
    //////////////////////////////////////////////////////

    function test_withdrawAllFromStrategy_happyPath() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.prank(governor);
        ousdVault.depositToStrategy(address(strategy), _toArray(address(usdc)), _toArray(uint256(100e6)));

        vm.prank(governor);
        ousdVault.withdrawAllFromStrategy(address(strategy));

        assertEq(usdc.balanceOf(address(strategy)), 0, "Strategy should be empty");
        assertEq(usdc.balanceOf(address(ousdVault)), 200e6, "Vault should have all USDC back");
    }

    function test_withdrawAllFromStrategy_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        ousdVault.withdrawAllFromStrategy(alice);
    }

    function test_withdrawAllFromStrategy_RevertWhen_notSupported() public {
        vm.prank(governor);
        vm.expectRevert("Strategy is not supported");
        ousdVault.withdrawAllFromStrategy(alice);
    }

    //////////////////////////////////////////////////////
    /// --- WITHDRAWALLFROMSTRATEGIES()
    //////////////////////////////////////////////////////

    function test_withdrawAllFromStrategies_happyPath() public {
        MockStrategy strategy1 = _deployAndApproveStrategy();
        MockStrategy strategy2 = _deployAndApproveStrategy();

        vm.startPrank(governor);
        ousdVault.depositToStrategy(address(strategy1), _toArray(address(usdc)), _toArray(uint256(80e6)));
        ousdVault.depositToStrategy(address(strategy2), _toArray(address(usdc)), _toArray(uint256(60e6)));
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(ousdVault)), 60e6, "Vault should have 60 USDC remaining");

        vm.prank(governor);
        ousdVault.withdrawAllFromStrategies();

        assertEq(usdc.balanceOf(address(strategy1)), 0, "Strategy 1 should be empty");
        assertEq(usdc.balanceOf(address(strategy2)), 0, "Strategy 2 should be empty");
        assertEq(usdc.balanceOf(address(ousdVault)), 200e6, "Vault should have all USDC back");
    }

    function test_withdrawAllFromStrategies_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        ousdVault.withdrawAllFromStrategies();
    }

    //////////////////////////////////////////////////////
    /// --- ALLOCATE() — CAPITAL PAUSED & NO AVAILABLE ASSET
    //////////////////////////////////////////////////////

    function test_allocate_RevertWhen_capitalPaused() public {
        vm.prank(governor);
        ousdVault.pauseCapital();

        vm.prank(governor);
        vm.expectRevert("Capital paused");
        ousdVault.allocate();
    }

    function test_allocate_returnsEarlyWhenNoAssetAvailable() public {
        MockStrategy strategy = _deployAndApproveStrategy();

        vm.startPrank(governor);
        ousdVault.setDefaultStrategy(address(strategy));
        // Disable solvency check — requesting all OUSD makes totalValue = 0
        ousdVault.setMaxSupplyDiff(0);
        vm.stopPrank();

        // Request withdrawal of all USDC so _assetAvailable() returns 0
        vm.prank(matt);
        ousdVault.requestWithdrawal(100e18);
        vm.prank(josh);
        ousdVault.requestWithdrawal(100e18);

        vm.prank(governor);
        ousdVault.allocate();

        // Strategy should receive nothing — all USDC reserved for withdrawal queue
        assertEq(usdc.balanceOf(address(strategy)), 0, "Strategy should receive nothing");
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
