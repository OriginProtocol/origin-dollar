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
 *      3. Call `setWithdrawalRate` to set the rate limit
 *
 *      An off-chain operator (e.g. Defender Relayer) calls `fundWithdrawals()`
 *      periodically. The module:
 *        - First tries to satisfy the queue from idle vault funds
 *        - If there's still a shortfall, withdraws from the configured strategy
 *        - Enforces a per-second rate limit (leaky bucket, capped at 1 day of
 *          accrual) so a single automated call can never drain the strategy
 *
 *      The Safe retains full override control via `setWithdrawalRate`,
 *      `resetAllowance`, and `setStrategy`.
 */
contract AutoWithdrawalModule is AbstractSafeModule {
    // ─────────────────────────────────────────────────────── Rate limiting ──

    struct WithdrawalLimit {
        /// @dev Timestamp of last withdrawal execution (or contract deployment).
        ///      Must be set to block.timestamp in the constructor to prevent the
        ///      "epoch exploit" where an uninitialised timestamp accrues a massive
        ///      allowance on the first call.
        uint64 lastWithdrawal;
        /// @dev Maximum asset units (in asset's native decimals, e.g. 6 for USDC)
        ///      that may be withdrawn per second.
        uint192 perSecond;
    }

    /// @notice Rate limit state for automated withdrawals.
    WithdrawalLimit public withdrawalLimit;

    /// @notice Maximum time window over which allowance can accumulate.
    ///         Caps the burst size if the operator is offline for an extended period.
    uint256 public constant MAX_ACCUMULATION_WINDOW = 1 days;

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

    /// @notice Emitted when the per-second rate limit has been exhausted and no
    ///         withdrawal is possible until more allowance accrues.
    event RateLimitReached(uint192 perSecond, uint64 lastWithdrawal);

    /// @notice Emitted when the Safe exec call to withdrawFromStrategy fails.
    event WithdrawalFailed(address indexed strategy, uint256 attemptedAmount);

    /// @notice Emitted when the withdrawal rate is updated.
    event WithdrawalRateUpdated(uint192 oldRate, uint192 newRate);

    /// @notice Emitted when the strategy address is updated.
    event StrategyUpdated(address oldStrategy, address newStrategy);

    // ─────────────────────────────────────────────────────── Constructor ──

    /**
     * @param _safeContract Address of the Gnosis Safe (Guardian multisig).
     * @param _operator     Address of the off-chain operator (e.g. Defender relayer).
     * @param _vault        Address of the OUSD/OETH vault.
     * @param _strategy     Initial strategy to pull liquidity from.
     * @param _perSecond    Initial withdrawal rate in asset units per second.
     *                      Set to 0 to deploy in a paused state.
     */
    constructor(
        address _safeContract,
        address _operator,
        address _vault,
        address _strategy,
        uint192 _perSecond
    ) AbstractSafeModule(_safeContract) {
        require(_vault != address(0), "Invalid vault");
        require(_strategy != address(0), "Invalid strategy");

        vault = IVault(_vault);
        asset = IVault(_vault).asset();
        strategy = _strategy;

        withdrawalLimit.perSecond = _perSecond;
        // CRITICAL: initialise to now so the first call doesn't accrue
        // elapsed = block.timestamp seconds worth of allowance.
        withdrawalLimit.lastWithdrawal = uint64(block.timestamp);

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
     *   3. Compute the rate-limited maximum withdrawal amount.
     *   4. Pull that amount from the strategy via the Safe.
     *
     * This function never reverts on "soft" failures (rate limit hit, strategy
     * underfunded). It emits a descriptive event instead so off-chain monitoring
     * can alert the team without breaking the Defender action.
     */
    function fundWithdrawals() external onlyOperator {
        // Step 1: Let the vault absorb any asset it already holds idle.
        // This is a permissionless call; no Safe exec needed.
        vault.addWithdrawalQueueLiquidity();

        // Step 2: Read the current shortfall.
        VaultStorage.WithdrawalQueueMetadata memory meta = vault
            .withdrawalQueueMetadata();
        uint256 shortfall = meta.queued - meta.claimable;

        if (shortfall == 0) {
            // Queue is fully funded — nothing to do.
            return;
        }

        // Step 3: Compute rate-limited allowance.
        WithdrawalLimit memory limit = withdrawalLimit;
        uint256 elapsed = block.timestamp - limit.lastWithdrawal;
        if (elapsed > MAX_ACCUMULATION_WINDOW) {
            elapsed = MAX_ACCUMULATION_WINDOW;
        }
        uint256 rateAllowance = elapsed * uint256(limit.perSecond);

        // Step 4: Read available balance from the strategy.
        uint256 strategyBalance = IStrategy(strategy).checkBalance(asset);

        // Step 5: Pick the binding constraint.
        uint256 toWithdraw = shortfall;
        if (rateAllowance < toWithdraw) toWithdraw = rateAllowance;
        if (strategyBalance < toWithdraw) toWithdraw = strategyBalance;

        if (toWithdraw == 0) {
            // Emit the most useful diagnostic event.
            if (strategyBalance == 0 || strategyBalance < shortfall) {
                emit InsufficientStrategyLiquidity(
                    strategy,
                    shortfall,
                    strategyBalance
                );
            } else {
                // strategyBalance was fine; rate limit was the bottleneck
                emit RateLimitReached(limit.perSecond, limit.lastWithdrawal);
            }
            return;
        }

        // Step 6: Optimistically consume rate allowance (partial-credit approach).
        // We advance lastWithdrawal by exactly the amount consumed, preserving
        // any unused allowance in the window for a follow-up call.
        //
        // New lastWithdrawal = now − (unused allowance / perSecond)
        //                    = now − (rateAllowance − toWithdraw) / perSecond
        //
        // Edge case: if perSecond == 0 we never reach here (toWithdraw would be 0).
        uint64 savedLastWithdrawal = limit.lastWithdrawal;
        uint64 newLastWithdrawal = uint64(
            block.timestamp -
                (rateAllowance - toWithdraw) /
                uint256(limit.perSecond)
        );
        withdrawalLimit.lastWithdrawal = newLastWithdrawal;

        // Step 7: Execute withdrawal via the Safe (which holds the Strategist role).
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
            // Restore the allowance — the withdrawal didn't happen.
            withdrawalLimit.lastWithdrawal = savedLastWithdrawal;
            emit WithdrawalFailed(strategy, toWithdraw);
            return;
        }

        emit LiquidityWithdrawn(strategy, toWithdraw, shortfall - toWithdraw);
    }

    // ─────────────────────────────────────────────────────── Guardian controls ──

    /**
     * @notice Update the per-second withdrawal rate limit.
     * @dev    Resets the accrued allowance to zero on rate change, consistent
     *         with FixedRateDripper.setDripRate(). This prevents the "save up
     *         while rate is low, then burst at a higher rate" attack.
     *         Setting _perSecond to 0 effectively pauses automated withdrawals.
     * @param _perSecond New rate in asset units per second.
     */
    function setWithdrawalRate(uint192 _perSecond) external onlySafe {
        uint192 oldRate = withdrawalLimit.perSecond;
        // Reset accumulator so no burst is possible from accrued allowance.
        withdrawalLimit.lastWithdrawal = uint64(block.timestamp);
        withdrawalLimit.perSecond = _perSecond;
        emit WithdrawalRateUpdated(oldRate, _perSecond);
    }

    /**
     * @notice Change the strategy from which liquidity is pulled.
     * @param _strategy New strategy address. Must not be zero.
     */
    function setStrategy(address _strategy) external onlySafe {
        require(_strategy != address(0), "Invalid strategy");
        address oldStrategy = strategy;
        strategy = _strategy;
        emit StrategyUpdated(oldStrategy, _strategy);
    }

    // ──────────────────────────────────────────────────────── View helpers ──

    /**
     * @notice How much asset the rate limit currently allows to be withdrawn
     *         right now (before any strategy balance check).
     * @return allowance Current accrued withdrawal allowance in asset units.
     */
    function withdrawalRateAvailable()
        external
        view
        returns (uint256 allowance)
    {
        WithdrawalLimit memory limit = withdrawalLimit;
        uint256 elapsed = block.timestamp - limit.lastWithdrawal;
        if (elapsed > MAX_ACCUMULATION_WINDOW) {
            elapsed = MAX_ACCUMULATION_WINDOW;
        }
        allowance = elapsed * uint256(limit.perSecond);
    }

    /**
     * @notice The current unmet shortfall in the vault's withdrawal queue.
     * @dev    This is a raw read of `queued - claimable`. It does NOT account for
     *         idle vault asset that `addWithdrawalQueueLiquidity()` would absorb.
     *         For a fully up-to-date figure, call `vault.addWithdrawalQueueLiquidity()`
     *         first (which is what `fundWithdrawals()` does).
     * @return shortfall Queue shortfall in asset units (vault asset decimals).
     */
    function pendingShortfall() external view returns (uint256 shortfall) {
        VaultStorage.WithdrawalQueueMetadata memory meta = vault
            .withdrawalQueueMetadata();
        shortfall = meta.queued - meta.claimable;
    }
}
