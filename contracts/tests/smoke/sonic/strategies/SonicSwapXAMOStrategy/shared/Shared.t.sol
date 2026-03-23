// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Sonic} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SonicSwapXAMOStrategy} from "contracts/strategies/sonic/SonicSwapXAMOStrategy.sol";
import {OSVault} from "contracts/vault/OSVault.sol";
import {OSonic} from "contracts/token/OSonic.sol";
import {IPair} from "contracts/interfaces/algebra/IAlgebraPair.sol";
import {IGauge} from "contracts/interfaces/algebra/IAlgebraGauge.sol";

abstract contract Smoke_SonicSwapXAMOStrategy_Shared_Test is BaseSmoke {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IERC20 internal wrappedSonic;
    IPair internal swapXPool;
    IGauge internal swapXGauge;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkSonic();
        _igniteDeployManager();
        _fetchContracts();
        _resolveActors();
        _labelContracts();
    }

    function _fetchContracts() internal {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        oSonic = OSonic(resolver.resolve("OSONIC_PROXY"));
        oSonicVault = OSVault(payable(resolver.resolve("OSONIC_VAULT_PROXY")));
        sonicSwapXAMOStrategy = SonicSwapXAMOStrategy(resolver.resolve("SONIC_SWAPX_AMO_STRATEGY_PROXY"));

        wrappedSonic = IERC20(Sonic.wS);
        swapXPool = IPair(sonicSwapXAMOStrategy.pool());
        swapXGauge = IGauge(sonicSwapXAMOStrategy.gauge());
    }

    function _resolveActors() internal {
        governor = sonicSwapXAMOStrategy.governor();
        strategist = oSonicVault.strategistAddr();
    }

    function _labelContracts() internal {
        vm.label(address(sonicSwapXAMOStrategy), "SonicSwapXAMOStrategy");
        vm.label(address(oSonic), "OSonic");
        vm.label(address(oSonicVault), "OSonicVault");
        vm.label(address(wrappedSonic), "WrappedSonic");
        vm.label(address(swapXPool), "SwapXPool");
        vm.label(address(swapXGauge), "SwapXGauge");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal wS to strategy and call deposit as vault
    function _depositToStrategy(uint256 amount) internal {
        deal(address(wrappedSonic), address(sonicSwapXAMOStrategy), amount);
        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.deposit(address(wrappedSonic), amount);
    }

    /// @dev Tilt the pool to have more wS than OS by swapping wS into the pool.
    ///      This creates an imbalance where swapOTokensToPool can improve balance.
    function _tiltPoolToMoreWS(uint256 amount) internal {
        deal(address(wrappedSonic), address(this), amount);
        IERC20(address(wrappedSonic)).transfer(address(swapXPool), amount);
        // Swap wS for OS: amount0Out=0 (wS), amount1Out=osOut (OS)
        uint256 osOut = swapXPool.getAmountOut(amount, address(wrappedSonic));
        swapXPool.swap(0, osOut, address(this), new bytes(0));
    }

    /// @dev Tilt the pool to have more OS than wS by swapping OS into the pool.
    ///      This creates an imbalance where swapAssetsToPool can improve balance.
    function _tiltPoolToMoreOS(uint256 amount) internal {
        // Mint OS via vault by pranking as the strategy (which is mint-whitelisted)
        vm.prank(address(sonicSwapXAMOStrategy));
        oSonicVault.mintForStrategy(amount);

        // Transfer OS from strategy to pool
        vm.prank(address(sonicSwapXAMOStrategy));
        IERC20(address(oSonic)).transfer(address(swapXPool), amount);

        // Swap OS for wS: amount0Out=wsOut (wS), amount1Out=0 (OS)
        uint256 wsOut = swapXPool.getAmountOut(amount, address(oSonic));
        swapXPool.swap(wsOut, 0, address(this), new bytes(0));
    }
}
