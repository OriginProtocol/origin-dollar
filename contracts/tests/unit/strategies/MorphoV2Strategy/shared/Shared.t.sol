// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Proxies, Strategies, Tokens, Vaults} from "tests/utils/Artifacts.sol";

// Interfaces
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IMorphoV2Strategy} from "contracts/interfaces/strategies/IMorphoV2Strategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Mocks
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockERC4626Vault} from "contracts/mocks/MockERC4626Vault.sol";
import {MockMorphoV2Vault} from "tests/mocks/MockMorphoV2Vault.sol";
import {MockMorphoV2Adapter} from "tests/mocks/MockMorphoV2Adapter.sol";

abstract contract Unit_MorphoV2Strategy_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & PROXIES
    //////////////////////////////////////////////////////

    IOToken internal ousd;
    IVault internal ousdVault;
    IProxy internal ousdProxy;
    IProxy internal ousdVaultProxy;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;
    address internal constant MERKLE_DISTRIBUTOR = 0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IMorphoV2Strategy internal strategy;
    MockERC20 internal asset;
    MockMorphoV2Vault internal shareVault;
    MockERC4626Vault internal underlyingV1Vault;
    MockMorphoV2Adapter internal adapter;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // Deploy real asset token
        asset = new MockERC20("Asset Token", "ASSET", 18);

        // Deploy the underlying V1 vault (a standard ERC4626 vault)
        underlyingV1Vault = new MockERC4626Vault(address(asset));

        // Deploy the adapter that points to the V1 vault
        // parentVault will be set to shareVault address after deployment
        adapter = new MockMorphoV2Adapter(address(underlyingV1Vault), address(0));

        // Deploy the Morpho V2 vault (platform) with adapter
        shareVault = new MockMorphoV2Vault(address(asset), address(adapter));

        // Deploy real OUSDVault as the OToken vault
        usdc = IERC20(address(asset));

        vm.startPrank(deployer);

        IOToken ousdImpl = IOToken(vm.deployCode(Tokens.OUSD));
        address ousdVaultImpl = vm.deployCode(Vaults.OUSD, abi.encode(address(asset)));

        ousdProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        ousdVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        ousdProxy.initialize(
            address(ousdImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(ousdVaultProxy), 1e27)
        );

        ousdVaultProxy.initialize(
            address(ousdVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(ousdProxy))
        );

        vm.stopPrank();

        ousd = IOToken(address(ousdProxy));
        ousdVault = IVault(address(ousdVaultProxy));

        // Configure vault
        vm.startPrank(governor);
        ousdVault.unpauseCapital();
        ousdVault.setStrategistAddr(strategist);
        ousdVault.setMaxSupplyDiff(5e16);
        ousdVault.setDripDuration(0);
        ousdVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // Deploy strategy with real vault
        strategy = IMorphoV2Strategy(
            vm.deployCode(
                Strategies.MORPHO_V2_STRATEGY, abi.encode(address(shareVault), address(ousdVault), address(asset))
            )
        );

        // Set governor via slot
        vm.store(address(strategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize
        vm.prank(governor);
        strategy.initialize();
    }

    function _labelContracts() internal {
        vm.label(address(strategy), "MorphoV2Strategy");
        vm.label(address(asset), "AssetToken");
        vm.label(address(shareVault), "ShareVault");
        vm.label(address(underlyingV1Vault), "UnderlyingV1Vault");
        vm.label(address(adapter), "MorphoV2Adapter");
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
