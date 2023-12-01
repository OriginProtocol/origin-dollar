// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Frax Convex Strategy
 * @notice Investment strategy for locking Frax Staked Convex Liquidity Provider tokens.
 * @dev This strategy can NOT be set as the Vault's default strategy for an asset.
 * This is because deposits and withdraws can be sandwich attacked if not protected
 * by the `VaultValueChecker`. Only the trusted `Strategist` or `Governor` can call
 * the Vault deposit and withdraw functions for a strategy. When they do, they must call
 * `VaultValueChecker.takeSnapshot` before and `VaultValueChecker.checkDelta` afterwards.
 *
 * When implementing for a new Curve pool, read-only reentrancy needs to be checked.
 * This is possible in some Curve pools when using native ETH or a token that has hooks
 * that can hijack execution. For example, the Curve ETH/stETH pool is vulnerable to
 * read-only reentry.
 * https://x.com/danielvf/status/1657019677544001536
 *
 * This strategy only supports assets with the same number of decimals. This is
 * checked in the initialize function.
 *
 * `collectRewardTokens`, `updateLock` and `withdrawAll` will revert with "Not enough reward tokens available"
 * if there is not enough FXS rewards in the Frax Convex Staking contract. eg stkcvxfrxeth-ng-f-frax.
 * This has happened multiple times in the past when the Frax team's rewards bot has
 * got out of synch with the weekly rewards cycle.
 *
 * There are multiple levels of tokens managed by this strategy
 * - Vault assets. eg WETH and frxETH
 * - Curve LP tokens. eg frxETH-ng-f
 * - Convex LP tokens. eg cvxfrxeth-ng-f
 * - Frax Staked Convex LP tokens. eg stkcvxfrxeth-ng-f-frax
 * - Locked Frax Staked Convex LP tokens which do not have a LP token. eg FraxUnifiedFarm_ERC20_Convex_frxETH
 *
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICurvePool } from "./curve/ICurvePool.sol";
import { CurveTwoCoinFunctions } from "./curve/CurveTwoCoinFunctions.sol";
import { IFraxConvexLocking } from "../interfaces/IFraxConvexLocking.sol";
import { IFraxConvexStaking } from "../interfaces/IFraxConvexStaking.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IERC20, BaseCurveStrategy, CurveFunctions, InitializableAbstractStrategy } from "./BaseCurveStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";

contract FraxConvexStrategy is CurveTwoCoinFunctions, BaseCurveStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    /// @notice The number of seconds to lock Frax Staked Convex LP tokens for.
    /// 7 days is the minimum to get token rewards.
    uint256 public constant LOCK_DURATION = 7 days + 1;
    uint256 public constant MIN_LOCK_AMOUNT = 1e17;
    /// @notice Value if not lock exists in the Frax Convex Locking contract.
    /// @dev Using a nonzero value to save gas when overriding with a real lock key
    bytes32 public constant NO_KEY =
        0x0000000000000000000000000000000000000000000000000000000000000001;

    /// @notice Wrapper contract for Frax Staked Convex pools (ConvexStakingWrapperFrax).
    /// @dev Has `deposit`, `withdrawAndUnwrap` and `getReward` functions.
    address public immutable fraxStaking;
    /// @notice Frax locking contract for Frax Staked Convex LP tokens. eg FraxUnifiedFarm_ERC20_Convex_frxETH
    /// @dev Has `stakeLocked`, `lockAdditional`, `lockLonger`, `withdrawLocked`, `lockedLiquidityOf`
    /// and `getReward` functions.
    address public immutable fraxLocking;

    /// @notice The key of the locked Frax Staked Convex LP tokens. eg locked stkcvxfrxeth-ng-f-frax
    /// @dev This strategy contract will only hold one lock at a time. It can not have multiple locks.
    /// If no lock exists the value will be `NO_KEY` which is a nonzero value to save gas.
    bytes32 public lockKey;
    /// @notice The UNIX timestamp in seconds when the lock expires.
    /// @dev limited to 64 bits so it is packed with the `targetLockedBalance` variable into a single slot.
    uint64 public unlockTimestamp;
    /// @notice the desired level of locked Frax Staked Convex LP tokens.
    /// @dev limited to 128 bits so it is packed with the `unlockTimestamp` variable into a single slot.
    uint128 public targetLockedBalance;

    event TargetLockedBalanceUpdated(uint256 _targetLockedBalance);
    event Lock(bytes32 lockKey, uint256 amount, uint256 unlockTimestamp);
    event Unlock(bytes32 lockKey, uint256 amount, uint256 unlockTimestamp);

    /**
     * @dev Verifies that the caller is the Strategist.
     */
    modifier onlyStrategist() {
        require(
            msg.sender == IVault(vaultAddress).strategistAddr(),
            "Caller is not the Strategist"
        );
        _;
    }

    struct FraxConvexConfig {
        address fraxStaking;
        address fraxLocking;
    }

    constructor(
        BaseStrategyConfig memory _stratConfig,
        CurveConfig memory _curveConfig,
        FraxConvexConfig memory _convexConfig
    )
        InitializableAbstractStrategy(_stratConfig)
        BaseCurveStrategy(_curveConfig)
        CurveTwoCoinFunctions(_curveConfig.curvePool)
    {
        fraxStaking = _convexConfig.fraxStaking;
        fraxLocking = _convexConfig.fraxLocking;
    }

    /**
     * Initializer for setting up the strategy's internal state in its proxy contract.
     * @param _rewardTokenAddresses Addresses of the CRV, CVX and FXS tokens.
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e. WETH, frxETH.
     * @param _pTokens Address of the Curve pool for each asset.
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // CRV + CVX + FXS
        address[] calldata _assets,
        address[] calldata _pTokens
    ) external onlyGovernor initializer {
        require(
            _assets.length == CURVE_POOL_ASSETS_COUNT,
            "Incorrect number of assets"
        );
        lockKey = NO_KEY;

        // This strategy only supports assets with the same number of decimals
        require(decimals0 == decimals1, "Decimals do not match");
        if (CURVE_POOL_ASSETS_COUNT == 3) {
            require(decimals1 == decimals2, "Decimals do not match");
        }

        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        _approveBase();
    }

    /**
     * @dev Connects this strategy to the Curve implementation functions.
     * In this case its a Curve pool with:
     * 1. two coins
     * 2. remove_liquidity_imbalance that includes a receiver
     * 3. calc_token_amount that includes fees
     */
    function getCurveFunctions()
        internal
        pure
        override(BaseCurveStrategy, CurveTwoCoinFunctions)
        returns (CurveFunctions memory)
    {
        return CurveTwoCoinFunctions.getCurveFunctions();
    }

    /**
     * @dev Unlock all the Frax Staked Convex LP tokens if:
     * - there is a lock and
     * - the lock has expired
     * @return unlockedAmount The amount of Frax Staked Convex LP tokens unlocked.
     * This will be zero if there is no lock or the lock has not yet expired.
     */
    function _unlock() internal returns (uint256 unlockedAmount) {
        // If a lock exists and it has expired
        if (lockKey != NO_KEY && block.timestamp > unlockTimestamp) {
            // Withdraw all the Frax Staked Convex LP tokens from the lock
            // to this strategy contract.
            // Have to withdraw all as we can't withdraw a partial amount.
            // The third `claim_rewards` parameter will still claim rewards even
            // when set to `false`. It will only not collect rewards if the
            // Frax Convex Locking contract has collectRewardsOnWithdrawalPaused = true.
            unlockedAmount = IFraxConvexLocking(fraxLocking).withdrawLocked(
                lockKey,
                address(this),
                false
            );

            emit Unlock(lockKey, unlockedAmount, unlockTimestamp);

            // The previous withdraw deletes the old lock so reset
            // slither-disable-next-line reentrancy-no-eth
            lockKey = NO_KEY;
        }
        // else no lock exists or has not expired so nothing to do.
    }

    /**
     * @dev Extends an existing lock for 7 days regardless of whether it has expired or not.
     * Create a new lock if one doesn't exist and there is a positive target locked balance.
     * Or add to the existing lock if the locked tokens is under the target locked balance.
     * @param unlockedBalance The balance of the Frax Staked Convex LP tokens that are NOT locked.
     * @param lockedBalance The balance of the Frax Staked Convex LP tokens that are locked.
     * This includes any tokens in an expired lock.
     */
    function _lock(uint256 unlockedBalance, uint256 lockedBalance) internal {
        uint64 newUnlockTimestamp = uint64(block.timestamp + LOCK_DURATION);
        // If a lock exists and does not expire in seven days
        if (lockKey != NO_KEY && unlockTimestamp < newUnlockTimestamp) {
            // Update the unlockTimestamp before the external lockLonger call
            unlockTimestamp = newUnlockTimestamp;

            // Extend the lock for another 7 days even if it has not yet expired
            IFraxConvexLocking(fraxLocking).lockLonger(
                lockKey,
                newUnlockTimestamp
            );
        }

        // If the locked balance is under the target lock balance
        if (lockedBalance < targetLockedBalance) {
            // Calculate the amount of Frax Staked Convex LP tokens to lock.
            // The target lock balance ignoring the unlocked balance
            uint256 targetLockAmount = targetLockedBalance - lockedBalance;
            // Use the smaller of the target lock amount or the unlocked balance
            uint256 lockAmount = targetLockAmount < unlockedBalance
                ? targetLockAmount
                : unlockedBalance;

            // Don't bother locking more if the amount is too small
            if (lockAmount < MIN_LOCK_AMOUNT) return;

            // If no lock exists
            if (lockKey == NO_KEY) {
                // Update the unlockTimestamp before the external stakeLocked or lockLonger calls
                // slither-disable-next-line reentrancy-no-eth
                unlockTimestamp = newUnlockTimestamp;

                // Lock the Frax Staked Convex LP tokens for the required duration
                // eg lock stkcvxfrxeth-ng-f-frax for 7 days
                // slither-disable-next-line reentrancy-no-eth
                lockKey = IFraxConvexLocking(fraxLocking).stakeLocked(
                    lockAmount,
                    LOCK_DURATION
                );

                emit Lock(lockKey, lockAmount, newUnlockTimestamp);
            } else {
                // If a lock exists:
                // Add Frax Staked Convex LP tokens to the existing lock.
                // eg add stkcvxfrxeth-ng-f-frax to the existing lock
                IFraxConvexLocking(fraxLocking).lockAdditional(
                    lockKey,
                    lockAmount
                );

                emit Lock(lockKey, lockAmount, newUnlockTimestamp);
            }
        }
        // else the target lock balance is not under the locked balance
        // so we do NOT want to add more tokens
    }

    /**
     * @dev Stake the Curve Pool LP tokens into the Frax Convex Staking contract.
     * The locked balance is NOT reset to the target lock balance.
     *
     * This will revert with "shutdown" if the Frax Staking contract is shutdown (isShutdown = true).
     */
    function _lpDepositAll() internal override {
        // Get the Curve LP tokens in this strategy
        uint256 curveLpBalance = IERC20(CURVE_LP_TOKEN).balanceOf(
            address(this)
        );

        // Deposit all the Curve LP tokens into the Frax Convex contracts
        // to receive Frax Staked Convex LP tokens.
        // eg deposit frxeth-ng-f for stkcvxfrxeth-ng-f-frax
        IFraxConvexStaking(fraxStaking).deposit(curveLpBalance, address(this));
    }

    /**
     * @dev Withdraw Curve Pool LP tokens from the Frax Convex staking contract.
     * This does NOT withdraw from any expired locked tokens.
     * The locked balance is NOT reset to the target lock balance.
     *
     * This will revert with "shutdown" if the Frax Staking contract is shutdown (isShutdown = true).
     * This will revert with "Withdrawals paused" if the Frax Convex Locking contracts has
     * expired locked tokens and `withdrawalsPaused` = true.
     * This will revert if there is not enough FXS rewards in the
     * Frax Convex Locking contract. See dev note in contract Natspec for more details.
     */
    function _lpWithdraw(uint256 curveLpTokens) internal override {
        // Get the strategy's balance of Frax Staked Convex LP tokens that are not locked.
        // This does NOT include tokens in an expired lock.
        uint256 unlockedBalance = IERC20(fraxStaking).balanceOf(address(this));

        // Revert if not enough unlocked Frax Staked Convex LP tokens
        require(curveLpTokens <= unlockedBalance, "Not enough unlocked");

        // Convert the Frax Staked Convex LP tokens to Curve LP tokens.
        // The Curve LP tokens will be sent to this strategy contract.
        IFraxConvexStaking(fraxStaking).withdrawAndUnwrap(curveLpTokens);
    }

    /**
     * @dev Withdraw what we can. If Frax Staked Convex LP tokens are still locked
     * leave and just withdraw the unlocked Frax Staked Convex LP tokens.
     * Sets the target lock balance to zero so we can withdraw any expired locked tokens.
     * Any unexpired locked tokens can be withdrawn once the lock has expired. These can not be
     * relocked after expiry as the target lock balance is zero.
     *
     * This will revert with "shutdown" if the Frax Staking contract is shutdown (isShutdown = true).
     * This will revert with "Withdrawals paused" if the Frax Convex Locking contracts has
     * expired locked tokens and `withdrawalsPaused` = true.
     * This will revert if there is not enough FXS rewards in the
     * Frax Convex Locking contract. See dev note in contract Natspec for more details.
     */
    function _lpWithdrawAll() internal override {
        // Set the target lock balance to zero so we can withdraw any expired locked tokens.
        targetLockedBalance = 0;

        // Withdraw all tokens from lock if it has expired
        _unlock();

        // Get the strategy's balance of Frax Staked Convex LP tokens that are not locked.
        // This will include any expired locks that were unlocked in the previous step.
        uint256 unlockedBalance = IERC20(fraxStaking).balanceOf(address(this));

        // Convert the unlocked Frax Staked Convex LP tokens to to Curve LP tokens.
        // The Curve LP tokens will be sent to this strategy contract.
        if (unlockedBalance > 0) {
            IFraxConvexStaking(fraxStaking).withdrawAndUnwrap(unlockedBalance);
        }
    }

    /**
     * @notice Anyone can adjust the amount of locked tokens to the target locked balance
     * and extend the lock for 7 days.
     * Only the Strategist can set the target locked balance.
     *
     * If locked balance > target lock balance,
     *   unlock all if lock has expired.
     * If locked balance < target lock balance,
     *   lock any excess unlocked tokens.
     *   If no lock exists, create a new lock.
     *   If a lock exists, add tokens to the existing lock.
     *
     * This will revert with "Staking paused" if the Frax Convex Locking contract has
     * paused staking (`stakingPaused` = true).
     * This will revert if there is not enough FXS rewards in the
     * Frax Convex Locking contract. See dev note in contract Natspec for more details.
     */
    function updateLock() external {
        // Get the strategy's balance of Frax Staked Convex LP tokens that are locked
        uint256 lockedBalance = IFraxConvexLocking(fraxLocking)
            .lockedLiquidityOf(address(this));

        // Unlock all if the locked balance is over the target lock balance
        if (lockedBalance > targetLockedBalance) {
            // Will only unlock if a lock exists and has expired.
            // Updated the locked balance if the lock has expired.
            lockedBalance -= _unlock();
        }

        // Get the strategy's balance of Frax Staked Convex LP tokens that are NOT locked
        // This will include any expired locks that were unlocked in the previous step.
        uint256 unlockedBalance = IERC20(fraxStaking).balanceOf(address(this));

        // Lock any excess unlocked tokens if under the locked target
        _lock(unlockedBalance, lockedBalance);
    }

    /**
     * @dev Approve the Frax Convex Staking contract to transfer Curve LP tokens
     * from this strategy contract.
     * Approve the Frax Convex Locking contract to transfer Frax Convex Staking LP tokens
     * from this strategy contract.
     */
    function _approveBase() internal override {
        IERC20 curveLpToken = IERC20(CURVE_LP_TOKEN);
        // Approve the  Wrapper contract for Frax Staked Convex pools (ConvexStakingWrapperFrax)
        // to transfer the Curve pool's LP token
        // slither-disable-next-line unused-return
        curveLpToken.approve(fraxStaking, type(uint256).max);

        // Approve the Frax contract that locks the Frax Staked Convex LP token
        // slither-disable-next-line unused-return
        IERC20(fraxStaking).approve(fraxLocking, type(uint256).max);
    }

    /**
     * @notice Get the asset's share of Curve LP value controlled by this strategy. This is the total value
     * of the Curve LP tokens that are:
     * 1. held in this strategy contract
     * 2. unlocked Frax Staked Convex LP tokens
     * 3. locked Frax Staked Convex LP tokens
     * This assume the locked or unlocked Frax Staked Convex LP tokens equals the Curve LP tokens.
     * The average is taken prevent the asset balances being manipulated by tilting the Curve pool.
     *
     * @dev This will NOT revert if the Frax Convex Staking contract has been shutdown or the
     * Frax Convex Locking contract has been paused for staking or withdraws.
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        public
        view
        override
        returns (uint256 balance)
    {
        require(_curveSupportedCoin(_asset), "Unsupported asset");

        // Curve LP tokens in this contract. This should generally be nothing as we
        // should always stake in the Frax Staking contract.
        uint256 curveLpTokens = IERC20(CURVE_LP_TOKEN).balanceOf(address(this));

        // Get the strategy's balance of Frax Staked Convex LP tokens that are not locked
        // This will be if there's a pending redeem request.
        curveLpTokens += IERC20(fraxStaking).balanceOf(address(this));

        // Get the strategy's locked Frax Staked Convex LP tokens
        curveLpTokens += IFraxConvexLocking(fraxLocking).lockedLiquidityOf(
            address(this)
        );

        if (curveLpTokens > 0) {
            // get_virtual_price is gas intensive, so only call it if we have LP tokens.
            // Convert the Curve LP tokens controlled by this strategy to a value in USD or ETH
            uint256 value = (curveLpTokens *
                ICurvePool(CURVE_POOL).get_virtual_price()) / 1e18;

            // Divide by the number of assets in the Curve pool. eg 2 for the frxETH/WETH pool.
            // An average is taken to prevent the balances being manipulated by tilting the Curve pool.
            // No matter what the balance of the asset in the Curve pool is, the value of each asset will
            // be the average of the Curve pool's total value.
            // This assumes all assets in the Curve pool have the same number of decimals.
            balance = value / CURVE_POOL_ASSETS_COUNT;
        }
    }

    /**
     * @dev Collect accumulated CRV, CVX and FXS rewards and send to Harvester.
     * The Frax Convex Locking contract can be paused for collecting rewards. If so,
     * `collectRewardTokens` will fail with "Rewards collection paused".
     * This will revert if there is not enough FXS rewards in the
     * Frax Convex Locking contract. See dev note in contract Natspec for more details.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // Collect CRV, CVX and FXS rewards from staking contract
        IFraxConvexStaking(fraxStaking).getReward(address(this));

        // Collect FXS rewards from locking contract
        // slither-disable-next-line unused-return
        IFraxConvexLocking(fraxLocking).getReward(address(this));

        // Transfer each of the rewards to the Harvester
        _collectRewardTokens();
    }

    /***************************************
                 Configuration
    ****************************************/

    /**
     * @notice Strategist sets the target locked Frax Staked Convex balance.
     * @param _targetLockedBalance the target Frax Staked Convex balance
     */
    function setTargetLockedBalance(uint128 _targetLockedBalance)
        external
        onlyStrategist
    {
        targetLockedBalance = _targetLockedBalance;
        emit TargetLockedBalanceUpdated(_targetLockedBalance);
    }
}
