// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Base as BaseAddresses, Mainnet} from "tests/utils/Addresses.sol";
import {Mocks} from "tests/utils/artifacts/Mocks.sol";
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Strategies} from "tests/utils/artifacts/Strategies.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {IBridgedWOETHMigrationStrategy} from "contracts/interfaces/IBridgedWOETHMigrationStrategy.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IStrategy} from "contracts/interfaces/IStrategy.sol";

struct BaseStrategyConfig {
    address platformAddress;
    address vaultAddress;
}

/// @notice Shared fixture for OETHb Phase 1: the V1 -> Migration upgrade on Base.
///
///         Unlike the other fork fixtures this one deliberately upgrades the LIVE
///         `BridgedWOETHStrategyProxy` rather than deploying a fresh proxy — preserving the
///         real V1 storage across the upgrade is the thing under test, and the wOETH the
///         migration ships is the balance that proxy actually holds. Everything else is fresh:
///         the migration implementation, the V3 Master it reads and ships to, and the CCIP
///         router (mocked, since a real `ccipSend` on a fork would go nowhere and the strategy
///         side accounting is what matters here).
abstract contract Fork_BridgedWOETHMigrationStrategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    /// @dev Per-call cap set by `scripts/deploy/base/004_OETHbV3WOETHMigration.s.sol`.
    uint256 internal constant MAX_PER_BRIDGE = 1000 ether;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IBridgedWOETHMigrationStrategy internal migration;
    IStrategy internal master;
    IERC20 internal woeth;
    address internal ccipRouter;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkBase();

        woeth = IERC20(BaseAddresses.BridgedWOETH);
        weth = IERC20(BaseAddresses.WETH);

        _deployMaster();
        _upgradeToMigration();
        _labelContracts();
    }

    /// @dev The V3 Master leg. `checkBalance` on it is the second half of the migration
    ///      invariant, and its address is baked into the migration implementation as the CCIP
    ///      recipient — on production those are the same address on both chains via CreateX,
    ///      but nothing here depends on that.
    function _deployMaster() internal {
        IProxy masterProxy = IProxy(vm.deployCode(Proxies.CROSS_CHAIN_STRATEGY_PROXY, abi.encode(governor)));

        address masterImpl = vm.deployCode(
            Strategies.MASTER_WOTOKEN_STRATEGY,
            abi.encode(
                BaseStrategyConfig({platformAddress: address(0), vaultAddress: BaseAddresses.OETHBaseVaultProxy}),
                BaseAddresses.WETH
            )
        );

        vm.prank(governor);
        masterProxy.initialize(masterImpl, governor, abi.encodeWithSignature("initialize(address)", operator));

        master = IStrategy(address(masterProxy));
    }

    function _upgradeToMigration() internal {
        // `ccipRouter` is immutable on the implementation, so mocking it means deploying the
        // implementation with the mock in place rather than patching afterwards.
        ccipRouter = vm.deployCode(Mocks.CCIP_ROUTER_MOCK);

        address migrationImpl = vm.deployCode(
            Strategies.BRIDGED_WOETH_MIGRATION_STRATEGY,
            abi.encode(
                BaseStrategyConfig({platformAddress: address(0), vaultAddress: BaseAddresses.OETHBaseVaultProxy}),
                BaseAddresses.WETH,
                BaseAddresses.BridgedWOETH,
                BaseAddresses.OETHBaseProxy,
                BaseAddresses.OETHBaseOracleRouter,
                address(master),
                ccipRouter,
                Mainnet.CCIPChainSelector
            )
        );

        vm.startPrank(BaseAddresses.timelock);
        IProxy(BaseAddresses.BridgedWOETHStrategyProxy).upgradeTo(migrationImpl);
        migration = IBridgedWOETHMigrationStrategy(BaseAddresses.BridgedWOETHStrategyProxy);
        migration.setMaxPerBridge(MAX_PER_BRIDGE);
        vm.stopPrank();

        // Native for the CCIP fee. The mock quotes zero, but `bridgeToRemote` still runs the
        // pre-funded branch of `_consumeNativeFee`.
        vm.deal(address(migration), 1 ether);
    }

    function _labelContracts() internal {
        vm.label(address(migration), "BridgedWOETHMigrationStrategy");
        vm.label(address(master), "MasterWOTokenStrategy");
        vm.label(ccipRouter, "MockCCIPRouter");
        vm.label(BaseAddresses.BridgedWOETH, "wOETH");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev How many full `MAX_PER_BRIDGE` batches the live position can fund, capped at 3 to
    ///      keep the test quick. Derived rather than pinned: the position drains as the real
    ///      migration proceeds, so a hardcoded count would rot.
    function _affordableBatches() internal view returns (uint256) {
        uint256 batches = woeth.balanceOf(address(migration)) / MAX_PER_BRIDGE;
        return batches > 3 ? 3 : batches;
    }
}
