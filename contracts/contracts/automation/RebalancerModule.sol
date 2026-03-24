// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";

import { IVault } from "../interfaces/IVault.sol";
import { VaultStorage } from "../vault/VaultStorage.sol";

/**
 * @title Rebalancer Module
 * @notice A Gnosis Safe module that automates OUSD vault rebalancing by
 *         withdrawing from overallocated strategies and depositing to
 *         underallocated strategies.
 *
 * @dev The Safe (Guardian multisig) must:
 *      1. Deploy this module
 *      2. Call `safe.enableModule(address(this))` to authorize it
 *
 *      An off-chain operator (e.g. Defender Action) calls
 *      `processWithdrawalsAndDeposits` periodically with computed strategy/amount
 *      arrays. Either array may be empty. All intelligence (APY fetching, target
 *      allocation, constraint enforcement) lives off-chain. This contract is a
 *      dumb executor.
 *
 *      The function uses soft failures: if a single strategy call fails via the
 *      Safe, the module emits an event and continues to the next strategy rather
 *      than reverting the entire batch.
 *
 *      The Safe retains full control via `setPaused`.
 */
contract RebalancerModule is AbstractSafeModule {
    // ───────────────────────────────────────────────────────── Immutables ──

    /// @notice The vault whose strategies are being rebalanced.
    IVault public immutable vault;

    /// @notice The vault's base asset (e.g. USDC for OUSD).
    address public immutable asset;

    // ────────────────────────────────────────────────────── Mutable config ──

    /// @notice When true, processWithdrawalsAndDeposits is blocked.
    bool public paused;

    /// @notice Strategies that this module is permitted to withdraw from or deposit into.
    mapping(address => bool) public isAllowedStrategy;

    // ─────────────────────────────────────────────────────────── Events ──

    /// @notice Emitted after processWithdrawals completes (even if some failed).
    event WithdrawalsProcessed(
        address[] strategies,
        uint256[] amounts,
        uint256 remainingShortfall
    );

    /// @notice Emitted after processDeposits completes (even if some failed).
    event DepositsProcessed(address[] strategies, uint256[] amounts);

    /// @notice Emitted when a single withdrawFromStrategy call fails via the Safe.
    event WithdrawalFailed(address indexed strategy, uint256 attemptedAmount);

    /// @notice Emitted when a single depositToStrategy call fails via the Safe.
    event DepositFailed(address indexed strategy, uint256 attemptedAmount);

    /// @notice Emitted when the paused state changes.
    event PausedStateChanged(bool paused);

    /// @notice Emitted when a strategy is added to the whitelist.
    event StrategyAllowed(address indexed strategy);

    /// @notice Emitted when a strategy is removed from the whitelist.
    event StrategyRevoked(address indexed strategy);

    // ─────────────────────────────────────────────────────── Constructor ──

    /**
     * @param _safeContract Address of the Gnosis Safe (Guardian multisig).
     * @param _operator     Address of the off-chain operator (e.g. Defender relayer).
     * @param _vault        Address of the OUSD vault.
     */
    constructor(
        address _safeContract,
        address _operator,
        address _vault
    ) AbstractSafeModule(_safeContract) {
        require(_vault != address(0), "Invalid vault");

        vault = IVault(_vault);
        asset = IVault(_vault).asset();

        _grantRole(OPERATOR_ROLE, _operator);
    }

    // ──────────────────────────────────────────────────────── Modifiers ──

    modifier whenNotPaused() {
        require(!paused, "Module is paused");
        _;
    }

    // ──────────────────────────────────────────────── Core automation ──

    /**
     * @notice Withdraw from overallocated strategies then deposit to underallocated
     *         ones. Either array may be empty — the contract loops over zero entries
     *         without reverting.
     *
     * @param _withdrawStrategies Strategies to withdraw from.
     * @param _withdrawAmounts    Amounts to withdraw from each strategy.
     * @param _depositStrategies  Strategies to deposit into.
     * @param _depositAmounts     Amounts to deposit into each strategy.
     */
    function processWithdrawalsAndDeposits(
        address[] calldata _withdrawStrategies,
        uint256[] calldata _withdrawAmounts,
        address[] calldata _depositStrategies,
        uint256[] calldata _depositAmounts
    ) external onlyOperator whenNotPaused {
        require(
            _withdrawStrategies.length == _withdrawAmounts.length,
            "Withdraw array length mismatch"
        );
        require(
            _depositStrategies.length == _depositAmounts.length,
            "Deposit array length mismatch"
        );
        vault.addWithdrawalQueueLiquidity();
        _executeWithdrawals(_withdrawStrategies, _withdrawAmounts);
        _executeDeposits(_depositStrategies, _depositAmounts);
        emit WithdrawalsProcessed(
            _withdrawStrategies,
            _withdrawAmounts,
            pendingShortfall()
        );
        emit DepositsProcessed(_depositStrategies, _depositAmounts);
    }

    // ─────────────────────────────────────── Guardian controls ──

    /**
     * @notice Pause or unpause the module.
     * @param _paused True to pause, false to unpause.
     */
    function setPaused(bool _paused) external onlySafe {
        paused = _paused;
        emit PausedStateChanged(_paused);
    }

    /**
     * @notice Add a strategy to the whitelist, allowing the operator to move
     *         funds into or out of it.
     * @param _strategy Strategy address to allow.
     */
    function allowStrategy(address _strategy) external onlySafe {
        require(_strategy != address(0), "Invalid strategy");
        isAllowedStrategy[_strategy] = true;
        emit StrategyAllowed(_strategy);
    }

    /**
     * @notice Remove a strategy from the whitelist.
     * @param _strategy Strategy address to revoke.
     */
    function revokeStrategy(address _strategy) external onlySafe {
        isAllowedStrategy[_strategy] = false;
        emit StrategyRevoked(_strategy);
    }

    // ──────────────────────────────────────────────────────── View helpers ──

    /**
     * @notice The current unmet shortfall in the vault's withdrawal queue.
     * @dev    This is a raw read of `queued - claimable`. It does NOT account for
     *         idle vault asset that `addWithdrawalQueueLiquidity()` would absorb.
     *         For a fully up-to-date figure, call `vault.addWithdrawalQueueLiquidity()`
     *         first (which is what `processWithdrawals` does).
     * @return shortfall Queue shortfall in asset units (vault asset decimals).
     */
    function pendingShortfall() public view returns (uint256 shortfall) {
        VaultStorage.WithdrawalQueueMetadata memory meta = vault
            .withdrawalQueueMetadata();
        shortfall = meta.queued - meta.claimable;
    }

    // ──────────────────────────────────────────────── Internal helpers ──

    /// @dev Execute withdrawFromStrategy for each (strategy, amount) pair via the Safe.
    function _executeWithdrawals(
        address[] calldata _strategies,
        uint256[] calldata _amounts
    ) internal {
        address[] memory assets = _toAddressArray(asset);
        for (uint256 i = 0; i < _strategies.length; i++) {
            if (_amounts[i] == 0) continue;
            require(isAllowedStrategy[_strategies[i]], "Strategy not allowed");
            bool success = safeContract.execTransactionFromModule(
                address(vault),
                0,
                abi.encodeWithSelector(
                    IVault.withdrawFromStrategy.selector,
                    _strategies[i],
                    assets,
                    _toUint256Array(_amounts[i])
                ),
                0
            );
            if (!success) {
                emit WithdrawalFailed(_strategies[i], _amounts[i]);
            }
        }
    }

    /// @dev Execute depositToStrategy for each (strategy, amount) pair via the Safe.
    function _executeDeposits(
        address[] calldata _strategies,
        uint256[] calldata _amounts
    ) internal {
        address[] memory assets = _toAddressArray(asset);
        for (uint256 i = 0; i < _strategies.length; i++) {
            if (_amounts[i] == 0) continue;
            require(isAllowedStrategy[_strategies[i]], "Strategy not allowed");
            bool success = safeContract.execTransactionFromModule(
                address(vault),
                0,
                abi.encodeWithSelector(
                    IVault.depositToStrategy.selector,
                    _strategies[i],
                    assets,
                    _toUint256Array(_amounts[i])
                ),
                0
            );
            if (!success) {
                emit DepositFailed(_strategies[i], _amounts[i]);
            }
        }
    }

    function _toAddressArray(address _addr)
        internal
        pure
        returns (address[] memory arr)
    {
        arr = new address[](1);
        arr[0] = _addr;
    }

    function _toUint256Array(uint256 _val)
        internal
        pure
        returns (uint256[] memory arr)
    {
        arr = new uint256[](1);
        arr[0] = _val;
    }
}
