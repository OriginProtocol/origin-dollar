// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";

import { IVault } from "../interfaces/IVault.sol";
import { VaultStorage } from "../vault/VaultStorage.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";

/**
 * @title Auto Withdrawal Module
 * @notice A Gnosis Safe module that automates funding the OUSD (or OETH) vault's
 *         withdrawal queue by pulling liquidity from a configured strategy.
 *
 * @dev The Safe (Guardian multisig) must:
 *      1. Deploy this module
 *      2. Call `safe.enableModule(address(this))` to authorize it
 *
 *      An off-chain operator (e.g. Defender Relayer) calls `fundWithdrawals()`
 *      periodically. The module:
 *        - First tries to satisfy the queue from idle vault funds
 *        - If there's still a shortfall, withdraws the exact shortfall amount
 *          from the configured strategy (up to what the strategy holds)
 *
 *      The Safe retains full override control via `setStrategy`.
 */
contract AutoWithdrawalModule is AbstractSafeModule {
    // ───────────────────────────────────────────────────────── Immutables ──

    /// @notice The vault whose withdrawal queue is being funded.
    IVault public immutable vault;

    /// @notice The vault's base asset (e.g. USDC for OUSD, WETH for OETH).
    ///         Stored as an address to match IStrategy.checkBalance() signature.
    address public immutable asset;

    // ────────────────────────────────────────────────────── Mutable config ──

    /// @notice The strategy from which liquidity is pulled to fill the queue.
    address public strategy;

    // ─────────────────────────────────────────────────────────── Events ──

    /// @notice Emitted when liquidity is successfully moved from strategy to vault.
    event LiquidityWithdrawn(
        address indexed strategy,
        uint256 amount,
        uint256 remainingShortfall
    );

    /// @notice Emitted when the strategy does not hold enough funds to cover the shortfall.
    ///         No withdrawal is attempted; an operator alert should fire on this event.
    event InsufficientStrategyLiquidity(
        address indexed strategy,
        uint256 shortfall,
        uint256 available
    );

    /// @notice Emitted when the Safe exec call to withdrawFromStrategy fails.
    event WithdrawalFailed(address indexed strategy, uint256 attemptedAmount);

    /// @notice Emitted when the strategy address is updated.
    event StrategyUpdated(address oldStrategy, address newStrategy);

    // ─────────────────────────────────────────────────────── Constructor ──

    /**
     * @param _safeContract Address of the Gnosis Safe (Guardian multisig).
     * @param _operator     Address of the off-chain operator (e.g. Defender relayer).
     * @param _vault        Address of the OUSD/OETH vault.
     * @param _strategy     Initial strategy to pull liquidity from.
     */
    constructor(
        address _safeContract,
        address _operator,
        address _vault,
        address _strategy
    ) AbstractSafeModule(_safeContract) {
        require(_vault != address(0), "Invalid vault");
        require(_strategy != address(0), "Invalid strategy");

        vault = IVault(_vault);
        asset = IVault(_vault).asset();

        _setStrategy(_strategy);

        _grantRole(OPERATOR_ROLE, _operator);
    }

    // ──────────────────────────────────────────────────── Core automation ──

    /**
     * @notice Fund the vault's withdrawal queue from the configured strategy.
     *         Called periodically by an off-chain operator (Defender Actions).
     *
     * Steps:
     *   1. Ask the vault to absorb any idle asset it already holds.
     *   2. Compute the remaining shortfall.
     *   3. Pull up to that amount from the strategy via the Safe.
     *
     * This function never reverts on "soft" failures (strategy underfunded,
     * Safe exec failure). It emits a descriptive event instead so off-chain
     * monitoring can alert the team without breaking the Defender action.
     */
    function fundWithdrawals() external onlyOperator {
        // Step 1: Let the vault absorb any asset it already holds idle.
        // This is a permissionless call; no Safe exec needed.
        vault.addWithdrawalQueueLiquidity();

        // Step 2: Read the current shortfall.
        uint256 shortfall = pendingShortfall();

        if (shortfall == 0) {
            // Queue is fully funded — nothing to do.
            return;
        }

        // Step 3: Read available balance from the strategy.
        uint256 strategyBalance = IStrategy(strategy).checkBalance(asset);

        // Withdraw the lesser of the shortfall and what the strategy holds.
        uint256 toWithdraw = shortfall < strategyBalance
            ? shortfall
            : strategyBalance;

        if (toWithdraw == 0) {
            emit InsufficientStrategyLiquidity(
                strategy,
                shortfall,
                strategyBalance
            );
            return;
        }

        // Step 4: Execute withdrawal via the Safe (which holds the Strategist role).
        address[] memory assets = new address[](1);
        assets[0] = asset;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = toWithdraw;

        bool success = safeContract.execTransactionFromModule(
            address(vault),
            0,
            abi.encodeWithSelector(
                IVault.withdrawFromStrategy.selector,
                strategy,
                assets,
                amounts
            ),
            0 // Call (not delegatecall)
        );

        if (!success) {
            emit WithdrawalFailed(strategy, toWithdraw);
            return;
        }

        emit LiquidityWithdrawn(strategy, toWithdraw, shortfall - toWithdraw);
    }

    // ─────────────────────────────────────────────────────── Guardian controls ──

    /**
     * @notice Change the strategy from which liquidity is pulled.
     * @param _strategy New strategy address. Must not be zero.
     */
    function setStrategy(address _strategy) external onlySafe {
        _setStrategy(_strategy);
    }

    function _setStrategy(address _strategy) internal {
        require(_strategy != address(0), "Invalid strategy");
        emit StrategyUpdated(strategy, _strategy);
        strategy = _strategy;
    }

    // ──────────────────────────────────────────────────────── View helpers ──

    /**
     * @notice The current unmet shortfall in the vault's withdrawal queue.
     * @dev    This is a raw read of `queued - claimable`. It does NOT account for
     *         idle vault asset that `addWithdrawalQueueLiquidity()` would absorb.
     *         For a fully up-to-date figure, call `vault.addWithdrawalQueueLiquidity()`
     *         first (which is what `fundWithdrawals()` does).
     * @return shortfall Queue shortfall in asset units (vault asset decimals).
     */
    function pendingShortfall() public view returns (uint256 shortfall) {
        VaultStorage.WithdrawalQueueMetadata memory meta = vault
            .withdrawalQueueMetadata();
        shortfall = meta.queued - meta.claimable;
    }
}
