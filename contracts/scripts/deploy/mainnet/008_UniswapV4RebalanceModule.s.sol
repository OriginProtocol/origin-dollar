// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";

// Contracts
import {UniswapV4RebalanceModule} from "contracts/automation/UniswapV4RebalanceModule.sol";
import {IUniswapV4RebalanceModule} from "contracts/interfaces/automation/IUniswapV4RebalanceModule.sol";
import {IPositionManager} from "contracts/interfaces/uniswap/v4/IPositionManager.sol";

// Addresses
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";

/// @title 008_UniswapV4RebalanceModule
/// @notice Deploys the Safe module that keeps the OUSD/USDe Uniswap v4 position one-sided: Talos
///         pulls the USDe the position bought to the Safe and puts the OUSD back. The ranges
///         (bid prices) stay a Safe decision; the `ousdV4Rebalance` Talos action only reports
///         where the market would put them.
/// @dev No governance proposal: the module sits on the OUSD v4 liquidity Safe, which already owns
///      the positions and the tokens. It touches no Vault or OToken.
///
///      REQUIRED POST-DEPLOY STEPS, as Safe transactions:
///      1. `enableModule(<module>)`, then check `isModuleEnabled(<module>)` reads true.
///      2. `<module>.configurePosition(457273, ...)` with the values in `_fork()`.
///      The Safe must also keep an OUSD stock at least as large as the USDe bought since the last
///      redemption, or re-adds are skipped (the pull is kept).
contract $008_UniswapV4RebalanceModule is AbstractDeployScript("008_UniswapV4RebalanceModule") {
    /// @dev ~20k OUSD on [0, 5]: the live position's liquidity.
    uint128 internal constant TARGET_LIQUIDITY = Mainnet.ousdUsdeV4PositionLiquidity;
    /// @dev 1% over the OUSD the target liquidity needs.
    uint128 internal constant MAX_AMOUNT0 = 20_200e18;
    uint128 internal constant MAX_RESET_AMOUNT0 = 1_000e18;
    /// @dev Operational backstop only: pricing assumes USDe always redeems 1:1.
    uint256 internal constant MAX_USDE_IN_SAFE = 1_000_000e18;

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        UniswapV4RebalanceModule module = new UniswapV4RebalanceModule(
            Mainnet.ousdV4LiquiditySafe,
            CrossChain.talosRelayer,
            Mainnet.uniswapV4PoolManager,
            Mainnet.uniswapV4PositionManager,
            Mainnet.permit2
        );
        _recordDeployment("UNISWAP_V4_REBALANCE_MODULE", address(module), type(UniswapV4RebalanceModule).name);
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        UniswapV4RebalanceModule module =
            UniswapV4RebalanceModule(payable(resolver.resolve("UNISWAP_V4_REBALANCE_MODULE")));

        require(address(module.safeContract()) == Mainnet.ousdV4LiquiditySafe, "Wrong Safe");
        require(address(module.poolManager()) == Mainnet.uniswapV4PoolManager, "Wrong pool manager");
        require(address(module.positionManager()) == Mainnet.uniswapV4PositionManager, "Wrong position manager");
        require(address(module.permit2()) == Mainnet.permit2, "Wrong permit2");
        require(module.hasRole(module.OPERATOR_ROLE(), CrossChain.talosRelayer), "Operator role not set");

        // The Safe and the position only exist from block 26181117; older fork pins stop here.
        if (
            Mainnet.ousdV4LiquiditySafe.code.length == 0
                || IPositionManager(Mainnet.uniswapV4PositionManager).nextTokenId() <= Mainnet.ousdUsdeV4PositionId
        ) {
            return;
        }

        // Enabling and configuring are Safe transactions, not part of any proposal, so they are
        // simulated here for the smoke tests to exercise the module. Guarded because `_fork()` is
        // re-run by every later smoke suite and Safe reverts on a double enable.
        ISafeModuleAdmin safe = ISafeModuleAdmin(Mainnet.ousdV4LiquiditySafe);
        if (!safe.isModuleEnabled(address(module))) {
            vm.prank(Mainnet.ousdV4LiquiditySafe);
            safe.enableModule(address(module));
        }
        require(safe.isModuleEnabled(address(module)), "Module not enabled on the Safe");

        if (module.getPosition(Mainnet.ousdUsdeV4PositionId).limits.targetLiquidity == 0) {
            vm.prank(Mainnet.ousdV4LiquiditySafe);
            module.configurePosition(
                Mainnet.ousdUsdeV4PositionId,
                IUniswapV4RebalanceModule.PositionLimits({
                    targetLiquidity: TARGET_LIQUIDITY,
                    maxAmount0: MAX_AMOUNT0,
                    maxResetAmount0: MAX_RESET_AMOUNT0,
                    maxToken1InSafe: MAX_USDE_IN_SAFE
                })
            );
        }
    }
}

// ==================== External Interface ==================== //

/// @notice Module management surface on a Gnosis Safe. Not part of ISafe, which only carries the
///         `execTransactionFromModule` call the modules themselves make.
interface ISafeModuleAdmin {
    function enableModule(address module) external;
    function isModuleEnabled(address module) external view returns (bool);
}
