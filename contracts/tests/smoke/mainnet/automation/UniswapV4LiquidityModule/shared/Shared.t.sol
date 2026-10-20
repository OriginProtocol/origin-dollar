// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Test utilities
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";

// --- Project imports
import {IUniswapV4LiquidityModule} from "contracts/interfaces/automation/IUniswapV4LiquidityModule.sol";
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";
import {IPositionManager} from "contracts/interfaces/uniswap/v4/IPositionManager.sol";

/// @dev Runs the deployed module against the live OUSD/USDe position. The Safe and the position
///      only exist from block 26181117, so the suite skips on older fork pins.
abstract contract Smoke_UniswapV4LiquidityModule_Shared_Test is BaseSmoke {
    IUniswapV4LiquidityModule internal module;
    IPositionManager internal positionManager;
    address internal safe;
    PoolKey internal key;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();

        positionManager = IPositionManager(Mainnet.uniswapV4PositionManager);
        if (
            Mainnet.ousdV4LiquiditySafe.code.length == 0
                || positionManager.nextTokenId() <= Mainnet.ousdUsdeV4PositionId
        ) {
            vm.skip(true);
        }

        _igniteDeployManager();
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        module = IUniswapV4LiquidityModule(resolver.resolve("UNISWAP_V4_LIQUIDITY_MODULE"));
        safe = Mainnet.ousdV4LiquiditySafe;
        key =
            PoolKey({currency0: Mainnet.OUSDProxy, currency1: Mainnet.USDe, fee: 0, tickSpacing: 1, hooks: address(0)});

        vm.label(address(module), "UniswapV4LiquidityModule");
        vm.label(safe, "OUSDv4LiquiditySafe");
        vm.label(CrossChain.talosRelayer, "TalosRelayer");
    }
}
