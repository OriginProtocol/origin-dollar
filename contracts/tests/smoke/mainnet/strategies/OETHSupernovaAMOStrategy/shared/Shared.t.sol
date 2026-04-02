// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IOETHSupernovaAMOStrategy} from "contracts/interfaces/strategies/IOETHSupernovaAMOStrategy.sol";
import {IPair} from "contracts/interfaces/algebra/IAlgebraPair.sol";
import {IGauge} from "contracts/interfaces/algebra/IAlgebraGauge.sol";

abstract contract Smoke_OETHSupernovaAMOStrategy_Shared_Test is BaseSmoke {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IOToken internal oeth;
    IVault internal oethVault;
    IOETHSupernovaAMOStrategy internal oethSupernovaAMOStrategy;
    IERC20 internal wrappedEther;
    IPair internal supernovaPool;
    IGauge internal supernovaGauge;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();
        _igniteDeployManager();
        _fetchContracts();
        _resolveActors();
        _labelContracts();
    }

    function _fetchContracts() internal {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        oeth = IOToken(resolver.resolve("OETH_PROXY"));
        oethVault = IVault(resolver.resolve("OETH_VAULT_PROXY"));
        oethSupernovaAMOStrategy = IOETHSupernovaAMOStrategy(resolver.resolve("OETH_SUPERNOVA_AMO_STRATEGY_PROXY"));

        wrappedEther = IERC20(Mainnet.WETH);
        supernovaPool = IPair(oethSupernovaAMOStrategy.pool());
        supernovaGauge = IGauge(oethSupernovaAMOStrategy.gauge());
    }

    function _resolveActors() internal {
        governor = oethSupernovaAMOStrategy.governor();
        strategist = oethVault.strategistAddr();
    }

    function _labelContracts() internal {
        vm.label(address(oethSupernovaAMOStrategy), "OETHSupernovaAMOStrategy");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(wrappedEther), "WETH");
        vm.label(address(supernovaPool), "SupernovaPool");
        vm.label(address(supernovaGauge), "SupernovaGauge");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal WETH to strategy and call deposit as vault
    function _depositToStrategy(uint256 amount) internal {
        deal(address(wrappedEther), address(oethSupernovaAMOStrategy), amount);
        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.deposit(address(wrappedEther), amount);
    }

    /// @dev Tilt the pool to have more WETH than OETH by swapping WETH into the pool.
    ///      This creates an imbalance where swapOTokensToPool can improve balance.
    function _tiltPoolToMoreWETH(uint256 amount) internal {
        deal(address(wrappedEther), address(this), amount);
        IERC20(address(wrappedEther)).transfer(address(supernovaPool), amount);
        // Swap WETH for OETH
        uint256 oethOut = supernovaPool.getAmountOut(amount, address(wrappedEther));
        // Determine swap direction based on token ordering
        if (supernovaPool.token0() == address(wrappedEther)) {
            // token0=WETH, token1=OETH: we want oethOut from token1
            supernovaPool.swap(0, oethOut, address(this), new bytes(0));
        } else {
            // token0=OETH, token1=WETH: we want oethOut from token0
            supernovaPool.swap(oethOut, 0, address(this), new bytes(0));
        }
    }

    /// @dev Tilt the pool to have more OETH than WETH by swapping OETH into the pool.
    ///      This creates an imbalance where swapAssetsToPool can improve balance.
    function _tiltPoolToMoreOETH(uint256 amount) internal {
        // Mint OETH via vault by pranking as the strategy (which is mint-whitelisted)
        vm.prank(address(oethSupernovaAMOStrategy));
        oethVault.mintForStrategy(amount);

        // Transfer OETH from strategy to pool
        vm.prank(address(oethSupernovaAMOStrategy));
        IERC20(address(oeth)).transfer(address(supernovaPool), amount);

        // Swap OETH for WETH
        uint256 wethOut = supernovaPool.getAmountOut(amount, address(oeth));
        // Determine swap direction based on token ordering
        if (supernovaPool.token0() == address(wrappedEther)) {
            // token0=WETH, token1=OETH: we want wethOut from token0
            supernovaPool.swap(wethOut, 0, address(this), new bytes(0));
        } else {
            // token0=OETH, token1=WETH: we want wethOut from token1
            supernovaPool.swap(0, wethOut, address(this), new bytes(0));
        }
    }
}
