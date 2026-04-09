// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Strategies} from "tests/utils/artifacts/Strategies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";
import {Vaults} from "tests/utils/artifacts/Vaults.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IMorphoV2Strategy} from "contracts/interfaces/strategies/IMorphoV2Strategy.sol";

abstract contract Fork_MorphoV2Strategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    /// @dev Storage slot 2 of the Morpho V2 vault holds the share guard address.
    ///      The share guard's canReceiveShares() is called during deposit to
    ///      verify the receiver is allowed to hold vault shares.
    uint256 internal constant MORPHO_V2_SHARE_GUARD_SLOT = 2;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IOToken internal ousd;
    IVault internal ousdVault;
    IProxy internal ousdProxy;
    IProxy internal ousdVaultProxy;
    IMorphoV2Strategy internal strategy;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();
        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // Use real USDC from fork
        usdc = IERC20(Mainnet.USDC);

        // Deploy fresh OUSD + OUSDVault
        vm.startPrank(deployer);

        address ousdImpl = vm.deployCode(Tokens.OUSD);
        address ousdVaultImpl = vm.deployCode(Vaults.OUSD, abi.encode(Mainnet.USDC));

        ousdProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        ousdVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        ousdProxy.initialize(
            ousdImpl, governor, abi.encodeWithSignature("initialize(address,uint256)", address(ousdVaultProxy), 1e27)
        );

        ousdVaultProxy.initialize(
            ousdVaultImpl, governor, abi.encodeWithSignature("initialize(address)", address(ousdProxy))
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

        // Deploy MorphoV2Strategy pointing at real Morpho V2 Vault
        strategy = IMorphoV2Strategy(
            vm.deployCode(
                Strategies.MORPHO_V2_STRATEGY, abi.encode(Mainnet.MorphoOUSDv2Vault, address(ousdVault), Mainnet.USDC)
            )
        );

        // Set governor via storage slot
        vm.store(address(strategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize strategy
        vm.prank(governor);
        strategy.initialize();

        // Register strategy with vault
        vm.prank(governor);
        ousdVault.approveStrategy(address(strategy));

        // The Morpho V2 vault has a share guard (stored at slot 2) that checks
        // canReceiveShares() before minting shares to a receiver.
        // Mock this call so the freshly deployed strategy is allowed to receive shares.
        address shareGuard =
            address(uint160(uint256(vm.load(Mainnet.MorphoOUSDv2Vault, bytes32(MORPHO_V2_SHARE_GUARD_SLOT)))));
        vm.mockCall(
            shareGuard, abi.encodeWithSignature("canReceiveShares(address)", address(strategy)), abi.encode(true)
        );
    }

    function _labelContracts() internal {
        vm.label(address(strategy), "MorphoV2Strategy");
        vm.label(address(ousd), "OUSD");
        vm.label(address(ousdVault), "OUSDVault");
        vm.label(Mainnet.USDC, "USDC");
        vm.label(Mainnet.MorphoOUSDv2Vault, "MorphoOUSDv2Vault");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal USDC to strategy then call deposit as vault
    function _depositAsVault(uint256 amount) internal {
        deal(Mainnet.USDC, address(strategy), amount);
        vm.prank(address(ousdVault));
        strategy.deposit(Mainnet.USDC, amount);
    }
}
