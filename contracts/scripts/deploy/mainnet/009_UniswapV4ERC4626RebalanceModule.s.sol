// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// Deployment framework
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";

// Contracts
import {UniswapV4ERC4626RebalanceModule} from "contracts/automation/UniswapV4ERC4626RebalanceModule.sol";
import {IPermit2} from "contracts/interfaces/uniswap/IPermit2.sol";
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";
import {IPositionManager} from "contracts/interfaces/uniswap/v4/IPositionManager.sol";

// Addresses
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";

/// @title 009_UniswapV4ERC4626RebalanceModule
/// @notice Deploys the Safe module that lets Talos keep the OUSD/sUSDe Uniswap v4 position
///         one-sided and just below the sUSDe NAV: burn it to the Safe, push the price down to the
///         new range bottom and mint OUSD on the new range. Talos decides everything off-chain;
///         the module only enforces guardrails, the main one being that it never sells OUSD below
///         the sUSDe NAV.
/// @dev No governance proposal: the module sits on the OUSD v4 liquidity Safe, which already owns
///      the position and the tokens. It touches no Vault or OToken.
///
///      REQUIRED POST-DEPLOY STEPS, as Safe transactions (all simulated in `_fork()`):
///      1. `enableModule(<module>)`, then check `isModuleEnabled(<module>)` reads true.
///      2. Only if not already done for 008: `OUSD.approve(Permit2, type(uint256).max)` and
///         `Permit2.approve(OUSD, PositionManager, type(uint160).max, type(uint48).max)`, so the
///         PositionManager can pay the mints the Safe initiates through the module.
contract $009_UniswapV4ERC4626RebalanceModule is AbstractDeployScript("009_UniswapV4ERC4626RebalanceModule") {
    /// @dev Cap on OUSD per mint and per reset swap.
    uint128 internal constant MAX_AMOUNT0 = 100_000e18;

    // ==================== Deployment Logic ==================== //

    function _execute() internal override {
        UniswapV4ERC4626RebalanceModule module = new UniswapV4ERC4626RebalanceModule(
            Mainnet.ousdV4LiquiditySafe,
            CrossChain.talosRelayer,
            Mainnet.uniswapV4PoolManager,
            Mainnet.uniswapV4PositionManager,
            _poolKey(),
            MAX_AMOUNT0
        );
        _recordDeployment(
            "UNISWAP_V4_ERC4626_REBALANCE_MODULE", address(module), type(UniswapV4ERC4626RebalanceModule).name
        );
    }

    // ==================== Fork Verification ==================== //

    function _fork() internal override {
        UniswapV4ERC4626RebalanceModule module =
            UniswapV4ERC4626RebalanceModule(payable(resolver.resolve("UNISWAP_V4_ERC4626_REBALANCE_MODULE")));

        require(address(module.safeContract()) == Mainnet.ousdV4LiquiditySafe, "Wrong Safe");
        require(module.poolId() == keccak256(abi.encode(_poolKey())), "Wrong pool");
        require(module.maxAmount0() == MAX_AMOUNT0, "Wrong cap");
        require(module.hasRole(module.OPERATOR_ROLE(), CrossChain.talosRelayer), "Operator role not set");

        // The Safe and the position only exist from block 26181117; older fork pins stop here.
        if (
            Mainnet.ousdV4LiquiditySafe.code.length == 0
                || IPositionManager(Mainnet.uniswapV4PositionManager).nextTokenId() <= Mainnet.ousdSusdeV4PositionId
        ) {
            return;
        }

        // Safe transactions, not part of any proposal, simulated so the smoke tests exercise the
        // module. Guarded because `_fork()` is re-run by every later smoke suite and Safe reverts
        // on a double enable.
        ISafeModuleAdmin safe = ISafeModuleAdmin(Mainnet.ousdV4LiquiditySafe);
        if (!safe.isModuleEnabled(address(module))) {
            vm.startPrank(Mainnet.ousdV4LiquiditySafe);
            safe.enableModule(address(module));
            IERC20Approve(Mainnet.OUSDProxy).approve(Mainnet.permit2, type(uint256).max);
            IPermit2(Mainnet.permit2)
                .approve(Mainnet.OUSDProxy, Mainnet.uniswapV4PositionManager, type(uint160).max, type(uint48).max);
            vm.stopPrank();
        }
        require(safe.isModuleEnabled(address(module)), "Module not enabled on the Safe");
    }

    function _poolKey() internal pure returns (PoolKey memory) {
        return
            PoolKey({currency0: Mainnet.OUSDProxy, currency1: Mainnet.sUSDe, fee: 0, tickSpacing: 1, hooks: address(0)});
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
