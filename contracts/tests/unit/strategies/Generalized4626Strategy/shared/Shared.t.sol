// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockERC4626Vault} from "contracts/mocks/MockERC4626Vault.sol";
import {OUSD} from "contracts/token/OUSD.sol";
import {OUSDVault} from "contracts/vault/OUSDVault.sol";
import {OUSDProxy} from "contracts/proxies/Proxies.sol";
import {VaultProxy} from "contracts/proxies/Proxies.sol";
import {Generalized4626Strategy} from "contracts/strategies/Generalized4626Strategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

abstract contract Unit_Generalized4626Strategy_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;
    address internal constant MERKLE_DISTRIBUTOR = 0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    Generalized4626Strategy internal strategy;
    MockERC20 internal asset;
    MockERC4626Vault internal shareVault;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // Deploy real asset token and ERC4626 vault
        asset = new MockERC20("Asset Token", "ASSET", 18);
        shareVault = new MockERC4626Vault(address(asset));

        // Deploy real OUSDVault as the OToken vault
        // Use the asset token as the vault's base asset
        usdc = IERC20(address(asset));

        vm.startPrank(deployer);

        OUSD ousdImpl = new OUSD();
        OUSDVault ousdVaultImpl = new OUSDVault(address(asset));

        ousdProxy = new OUSDProxy();
        ousdVaultProxy = new VaultProxy();

        ousdProxy.initialize(
            address(ousdImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(ousdVaultProxy), 1e27)
        );

        ousdVaultProxy.initialize(
            address(ousdVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(ousdProxy))
        );

        vm.stopPrank();

        ousd = OUSD(address(ousdProxy));
        ousdVault = OUSDVault(address(ousdVaultProxy));

        // Configure vault
        vm.startPrank(governor);
        ousdVault.unpauseCapital();
        ousdVault.setStrategistAddr(strategist);
        ousdVault.setMaxSupplyDiff(5e16);
        ousdVault.setDripDuration(0);
        ousdVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // Deploy strategy with real vault
        strategy = new Generalized4626Strategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(shareVault), vaultAddress: address(ousdVault)
            }),
            address(asset)
        );

        // Set governor via slot
        vm.store(address(strategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize
        vm.prank(governor);
        strategy.initialize();
    }

    function _labelContracts() internal {
        vm.label(address(strategy), "Generalized4626Strategy");
        vm.label(address(asset), "AssetToken");
        vm.label(address(shareVault), "ShareVault");
        vm.label(address(ousdVault), "OUSDVault");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _depositAsVault(uint256 _amount) internal {
        asset.mint(address(strategy), _amount);
        vm.prank(address(ousdVault));
        strategy.deposit(address(asset), _amount);
    }
}
