// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Fork_BridgedWOETHMigrationStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Base as BaseAddresses, CrossChain, Mainnet} from "tests/utils/Addresses.sol";

/// @notice OETHb Phase 1 migration: the V1 -> Migration upgrade and the `bridgeToRemote` batches.
///
///         The invariant worth protecting is that the vault's view of this position never moves
///         while wOETH is in flight: `migration.checkBalance + master.checkBalance` stays
///         constant. Master only learns about the transfer when Remote reports back, so between
///         the CCIP send and that report the value has to live in the migration strategy's
///         in-flight term or it vanishes from the vault's total supply backing.
contract Fork_BridgedWOETHMigrationStrategy_Migration_Test is Fork_BridgedWOETHMigrationStrategy_Shared_Test {
    function test_upgrade_preservesV1State() public view {
        // V1 storage still readable at the same slots through the new implementation.
        assertGt(migration.lastOraclePrice(), 0, "lastOraclePrice lost");
        assertGt(migration.maxPriceDiffBps(), 0, "maxPriceDiffBps lost");

        // Inherited immutables, which the new implementation's constructor has to reproduce.
        assertEq(migration.weth(), BaseAddresses.WETH, "weth mismatch");
        assertEq(migration.bridgedWOETH(), BaseAddresses.BridgedWOETH, "bridgedWOETH mismatch");
        assertEq(migration.oethb(), BaseAddresses.OETHBaseProxy, "oethb mismatch");
        assertEq(migration.oracle(), BaseAddresses.OETHBaseOracleRouter, "oracle mismatch");
        assertEq(migration.vaultAddress(), BaseAddresses.OETHBaseVaultProxy, "vault mismatch");
        assertEq(migration.governor(), BaseAddresses.timelock, "governor mismatch");

        // Migration-only state starts clean.
        assertEq(migration.master(), address(master), "master not baked in");
        assertEq(migration.ccipChainSelectorMainnet(), Mainnet.CCIPChainSelector, "wrong CCIP destination");
        assertEq(migration.maxPerBridge(), MAX_PER_BRIDGE, "cap not set");
        assertEq(migration.totalBridged(), 0, "totalBridged should start at zero");
    }

    function test_bridgeToRemote_RevertWhen_aboveTheCap() public {
        vm.prank(CrossChain.multichainStrategist);
        vm.expectRevert("BWM: bad amount");
        migration.bridgeToRemote(MAX_PER_BRIDGE + 1);
    }

    function test_bridgeToRemote_RevertWhen_zero() public {
        vm.prank(CrossChain.multichainStrategist);
        vm.expectRevert("BWM: bad amount");
        migration.bridgeToRemote(0);
    }

    /// @dev Walks the migration state table batch by batch. Master reports zero throughout —
    ///      CCIP delivery is mocked, so nothing ever arrives on the other side — which is
    ///      precisely the window the in-flight term exists to cover.
    function test_bridgeToRemote_conservesTheVaultsView() public {
        uint256 batches = _affordableBatches();
        assertGt(batches, 0, "position too small to bridge a batch");

        uint256 startingLocal = woeth.balanceOf(address(migration));
        uint256 oraclePrice = migration.lastOraclePrice();
        uint256 totalBefore = migration.checkBalance(BaseAddresses.WETH);

        assertEq(master.checkBalance(BaseAddresses.WETH), 0, "master should start empty");

        uint256 bridgedSoFar;
        for (uint256 i; i < batches; ++i) {
            vm.prank(CrossChain.multichainStrategist);
            migration.bridgeToRemote(MAX_PER_BRIDGE);
            bridgedSoFar += MAX_PER_BRIDGE;

            uint256 local = woeth.balanceOf(address(migration));
            uint256 masterBalance = master.checkBalance(BaseAddresses.WETH);

            assertEq(migration.totalBridged(), bridgedSoFar, "totalBridged mismatch");
            assertEq(local, startingLocal - bridgedSoFar, "local wOETH mismatch");
            assertEq(masterBalance, 0, "master reported early");

            // checkBalance = (local + inFlight) * oraclePrice / 1e18, and with Master at zero
            // the in-flight term is the whole bridged amount.
            assertEq(
                migration.checkBalance(BaseAddresses.WETH),
                ((local + bridgedSoFar) * oraclePrice) / 1 ether,
                "checkBalance formula mismatch"
            );

            // The invariant: the vault's total view of the position is unchanged.
            assertEq(
                migration.checkBalance(BaseAddresses.WETH) + masterBalance,
                totalBefore,
                "value not conserved across the bridge"
            );
        }

        assertEq(_sentMessages(), batches, "one CCIP send per batch");
    }

    /// @dev Custody check: the wOETH really leaves the strategy on a send. With the real router
    ///      it moves into the CCIP token pool; the mock stands in for that escrow.
    function test_bridgeToRemote_movesCustodyToTheRouter() public {
        uint256 stratBefore = woeth.balanceOf(address(migration));
        assertGe(stratBefore, MAX_PER_BRIDGE, "position too small to bridge a batch");

        uint256 routerBefore = woeth.balanceOf(ccipRouter);

        vm.prank(CrossChain.multichainStrategist);
        migration.bridgeToRemote(MAX_PER_BRIDGE);

        assertEq(woeth.balanceOf(address(migration)), stratBefore - MAX_PER_BRIDGE, "strategy not debited");
        assertEq(woeth.balanceOf(ccipRouter), routerBefore + MAX_PER_BRIDGE, "router not credited");
    }

    function _sentMessages() internal view returns (uint256 count) {
        (bool ok, bytes memory ret) = ccipRouter.staticcall(abi.encodeWithSignature("sentMessagesLength()"));
        require(ok, "sentMessagesLength failed");
        count = abi.decode(ret, (uint256));
    }
}
