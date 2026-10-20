// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";

// Contracts
import {UniswapV4LiquidityModule} from "contracts/automation/UniswapV4LiquidityModule.sol";
import {IPermit2} from "contracts/interfaces/uniswap/IPermit2.sol";

// Addresses
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";

/// @title 010_UniswapV4LiquidityModule
/// @notice Deploys the generic Safe module that lets Talos move the OUSD v4 liquidity Safe's
///         Uniswap v4 positions: burn a Safe position, reset the price, mint a new one. It holds
///         no pricing logic; Talos prices, so a pricing change never needs a redeploy. The first
///         pool is OUSD/USDe, re-ranged every 2 minutes on the KyberSwap bid
///         (`ousdUsdeV4Rebalance`). It replaces module 008 on that pool.
/// @dev No governance proposal: the module sits on the OUSD v4 liquidity Safe, which already owns
///      the positions and the tokens. It touches no Vault or OToken.
///
///      REQUIRED POST-DEPLOY STEPS, as Safe transactions (all simulated in `_fork()`):
///      1. `enableModule(<module>)`, then check `isModuleEnabled(<module>)` reads true.
///      2. `setMaxPerDay(OUSD, 200k)`.
///      3. Only if not already done for 008/009: `OUSD.approve(Permit2, max)` and
///         `Permit2.approve(OUSD, PositionManager, max, max)`.
///      Once Talos runs `ousdUsdeV4Rebalance`: disable the `ousd_v4_rebalance` schedule, then
///      `disableModule(<008>)`.
contract $010_UniswapV4LiquidityModule is AbstractDeployScript("010_UniswapV4LiquidityModule") {
    /// @dev Net OUSD outflow from the Safe through the module per UTC day; bounds the loss if the
    ///      operator key is compromised.
    uint256 internal constant MAX_PER_DAY_OUSD = 200_000e18;

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        UniswapV4LiquidityModule module = new UniswapV4LiquidityModule(
            Mainnet.ousdV4LiquiditySafe,
            CrossChain.talosRelayer,
            Mainnet.uniswapV4PoolManager,
            Mainnet.uniswapV4PositionManager
        );
        _recordDeployment("UNISWAP_V4_LIQUIDITY_MODULE", address(module), type(UniswapV4LiquidityModule).name);
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        UniswapV4LiquidityModule module =
            UniswapV4LiquidityModule(payable(resolver.resolve("UNISWAP_V4_LIQUIDITY_MODULE")));

        require(address(module.safeContract()) == Mainnet.ousdV4LiquiditySafe, "Wrong Safe");
        require(address(module.poolManager()) == Mainnet.uniswapV4PoolManager, "Wrong pool manager");
        require(address(module.positionManager()) == Mainnet.uniswapV4PositionManager, "Wrong position manager");
        require(module.hasRole(module.OPERATOR_ROLE(), CrossChain.talosRelayer), "Operator role not set");

        // The Safe only exists from block 26181117; older fork pins stop here.
        if (Mainnet.ousdV4LiquiditySafe.code.length == 0) return;

        // Safe transactions, not part of any proposal, simulated so the smoke tests exercise the
        // module. Guarded because `_fork()` is re-run by every later smoke suite and Safe reverts
        // on a double enable.
        ISafeModuleAdmin safe = ISafeModuleAdmin(Mainnet.ousdV4LiquiditySafe);
        if (!safe.isModuleEnabled(address(module))) {
            vm.startPrank(Mainnet.ousdV4LiquiditySafe);
            safe.enableModule(address(module));
            module.setMaxPerDay(Mainnet.OUSDProxy, MAX_PER_DAY_OUSD);
            IERC20Approve(Mainnet.OUSDProxy).approve(Mainnet.permit2, type(uint256).max);
            IPermit2(Mainnet.permit2)
                .approve(Mainnet.OUSDProxy, Mainnet.uniswapV4PositionManager, type(uint160).max, type(uint48).max);
            vm.stopPrank();
        }
        require(safe.isModuleEnabled(address(module)), "Module not enabled on the Safe");
        require(module.maxPerDay(Mainnet.OUSDProxy) == MAX_PER_DAY_OUSD, "OUSD daily cap not set");
    }
}

// ==================== External Interfaces ==================== //

/// @notice Module management surface on a Gnosis Safe.
interface ISafeModuleAdmin {
    function enableModule(address module) external;
    function isModuleEnabled(address module) external view returns (bool);
}

interface IERC20Approve {
    function approve(address spender, uint256 amount) external returns (bool);
}
