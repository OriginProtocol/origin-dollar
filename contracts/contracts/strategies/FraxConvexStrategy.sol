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
 * There are multiple levels of tokens managed by this strategy
 * - Vault assets. eg WETH and frxETH
 * - Curve LP tokens. eg frxETH-ng-f
 * - Convex LP tokens. eg cvxfrxeth-ng-f
 * - Frax Staked Convex LP tokens. eg stkcvxfrxeth-ng-f-frax
 * - Locked Frax Staked Convex LP tokens which do not have a LP token
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
    uint256 constant LOCK_DURATION = 7 days + 1;
    uint256 constant MIN_LOCK_AMOUNT = 1e17;

    /// @notice Wrapper contract for Frax Staked Convex pools (ConvexStakingWrapperFrax)
    /// @dev Has deposit, withdrawAndUnwrap and getReward functions
    address public immutable fraxStaking;
    /// @notice Frax locking contract for Frax Staked Convex LP tokens. eg FraxUnifiedFarm_ERC20_Convex_frxETH
    /// @dev Has stakeLocked, lockAdditional, lockLonger, withdrawLocked and lockedLiquidityOf functions
    address public immutable fraxLocking;

    /// @notice The key of locked Frax Staked Convex LP tokens. eg locked stkcvxfrxeth-ng-f-frax
    bytes32 lockKey;
    /// @notice the desired level of locked Frax Staked Convex LP tokens
    /// @dev limited to 128 bits so it is packed with the following unlockTimestamp storage variable into single slot
    uint128 targetLockedBalance;
    /// @notice The UNIX timestamp in seconds when the lock expires
    uint64 unlockTimestamp;

    event TargetLockedBalanceUpdated(uint256 _targetLockedBalance);

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
     * Initializer for setting up strategy internal state.
     * @param _rewardTokenAddresses Address of CRV, CVX and FXS
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                DAI, USDC, USDT
     * @param _pTokens Address of the Curve pool for each asset
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

        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        _approveBase();
    }

    function getCurveFunctions()
        internal
        pure
        override(BaseCurveStrategy, CurveTwoCoinFunctions)
        returns (CurveFunctions memory)
    {
        return CurveTwoCoinFunctions.getCurveFunctions();
    }

    /**
     * @dev Unlock all the Frax Convex LP tokens if
     * - there is a lock and
     * - the lock has expired and
     * - the locked balance is over the target lock balance
     * @param lockedBalance The balance of the Frax Staked Convex LP tokens that are locked.
     * This includes any tokens in an expired lock.
     * @return unlockedAmount The amount of Frax Staked Convex LP tokens unlocked.
     * This can be zero if the lock has not expired yet.
     */
    function _unlock(uint256 lockedBalance)
        internal
        returns (uint256 unlockedAmount)
    {
        // If over the target lock balance
        if (
            lockKey > 0 &&
            block.timestamp > unlockTimestamp &&
            targetLockedBalance < lockedBalance
        ) {
            // Withdraw all the Frax Staked Convex LP tokens from the lock
            // to this strategy contract and do not claim rewards.
            // Have to withdraw all as we can't withdraw a partial amount.
            // slither-disable-next-line unused-return
            IFraxConvexLocking(fraxLocking).withdrawLocked(
                lockKey,
                address(this),
                false
            );

            // The previous withdraw deletes the old lock
            // slither-disable-next-line reentrancy-no-eth
            lockKey = bytes32(0);

            // This assumes all the locked Frax Staked Convex LP tokens are withdraw from the lock.
            // that is, there are no rounding issues.
            unlockedAmount = lockedBalance;
        }
        // else the lock does not exist or has not expired
        // return unlockedAmount = 0
    }

    /**
     * @param unlockedBalance The balance of the Frax Staked Convex LP tokens that are NOT locked.
     * @param lockedBalance The balance of the Frax Staked Convex LP tokens that are locked.
     * This includes any tokens in an expired lock.
     */
    function _lock(uint256 unlockedBalance, uint256 lockedBalance) internal {
        // If under the target lock balance
        if (targetLockedBalance > lockedBalance) {
            // Calculate the amount of Frax Staked Convex LP tokens to lock.
            // The target lock balance ignoring the unlocked balance
            uint256 targetLockAmount = targetLockedBalance - lockedBalance;
            // Use the smaller of the target lock amount or the unlocked balance
            uint256 lockAmount = targetLockAmount < unlockedBalance
                ? targetLockAmount
                : unlockedBalance;

            // Don't bother locking if the amount is too small
            if (lockAmount < MIN_LOCK_AMOUNT) return;

            // Update the unlockTimestamp before the external stakeLocked or lockLonger calls
            // slither-disable-next-line reentrancy-no-eth
            unlockTimestamp = uint64(block.timestamp + LOCK_DURATION);

            // If no lock exists
            if (lockKey == bytes32(0)) {
                // Lock the Frax Staked Convex LP tokens for the required duration
                // eg lock stkcvxfrxeth-ng-f-frax for 7 days
                lockKey = IFraxConvexLocking(fraxLocking).stakeLocked(
                    lockAmount,
                    LOCK_DURATION
                );
            } else {
                // Add Frax Staked Convex LP tokens to the existing lock.
                // Add even if the lock has expired as we'll extend the lock next if needed.
                // eg add stkcvxfrxeth-ng-f-frax to the existing lock
                IFraxConvexLocking(fraxLocking).lockAdditional(
                    lockKey,
                    lockAmount
                );

                // Extend the lock for another 7 days even if it has not expired yet
                IFraxConvexLocking(fraxLocking).lockLonger(
                    lockKey,
                    block.timestamp + LOCK_DURATION
                );
            }
        }
        // else the target lock balance is not under the locked balance
        // so we do NOT want to add more tokens or time to the existing lock
    }

    /**
     * @dev Stake the Curve Pool LP tokens into the Frax Convex staking contract and
     * lock up to the target lock level for 7 days.
     *
     * This will revert if the Frax Staking contract or Convex pool has been shut down.
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

        // Get the strategy's balance of Frax Staked Convex LP tokens that are locked.
        // this includes tokens in an expired lock.
        uint256 lockedBalance = IFraxConvexLocking(fraxLocking)
            .lockedLiquidityOf(address(this));
        // Get the strategy's balance of Frax Staked Convex LP tokens that are not locked
        uint256 unlockedBalance = IERC20(fraxStaking).balanceOf(address(this));

        // Unlock all if the locked balance is over the target lock balance and the lock has expired
        _unlock(lockedBalance);

        // Lock more if the locked balance is under the target lock balance
        // and extend the lock for a full duration even if the lock has not expired.
        _lock(unlockedBalance, lockedBalance);
    }

    /**
     * @dev
     *
     * This will NOT revert if the Convex pool has been shut down.
     */
    function _lpWithdraw(uint256 curveLpTokens) internal override {
        // - strategist has previously set a low enough target locked amount

        // Get the strategy's balance of Frax Staked Convex LP tokens that are not locked.
        // This does not include tokens in an expired lock.
        uint256 unlockedBalance = IERC20(fraxStaking).balanceOf(address(this));
        // Get the strategy's balance of Frax Staked Convex LP tokens that are locked.
        // this includes tokens in an expired lock.
        uint256 lockedBalance = IFraxConvexLocking(fraxLocking)
            .lockedLiquidityOf(address(this));

        // revert if not enough unlocked tokens and
        //  (locked tokens have not expired or
        //  not enough unlocked + expired locked tokens)
        require(
            curveLpTokens <= unlockedBalance ||
                (unlockTimestamp < block.timestamp &&
                    curveLpTokens <= unlockedBalance + lockedBalance),
            "Not enough unlocked"
        );

        // unlock all locked tokens if not enough unlocked tokens
        if (curveLpTokens > unlockedBalance) {
            unlockedBalance += _unlock(lockedBalance);
        }

        // convert the Frax Staked Convex LP tokens to to Curve LP tokens
        IFraxConvexStaking(fraxStaking).withdrawAndUnwrap(curveLpTokens);
        unlockedBalance -= curveLpTokens;

        // lock any excess unlocked tokens if under the locked target
        _lock(unlockedBalance, lockedBalance);
    }

    /**
     * @dev Withdraw what we can. If Frax Staked Convex LP tokens are still locked
     * leave and just withdraw the unlocked Frax Staked Convex LP tokens.
     * Sets the target lock balance to zero so we can withdraw any expired locked tokens.
     * Any locked tokens can with withdraw once the lock has expired. These can not be
     * relocked after expiry as the target lock balance is zero.
     *
     * This will NOT revert if the Convex pool has been shut down.
     * This will revert if the Frax Convex contracts have been paused.
     */
    function _lpWithdrawAll() internal override {
        // Set the target lock balance to zero so we can withdraw
        // any expired locked tokens.
        targetLockedBalance = 0;

        // Get the strategy's balance of Frax Staked Convex LP tokens that are not locked.
        // This does not include tokens in an expired lock.
        uint256 unlockedBalance = IERC20(fraxStaking).balanceOf(address(this));

        // Get the strategy's balance of Frax Staked Convex LP tokens that are locked.
        // this includes tokens in an expired lock.
        uint256 lockedBalance = IFraxConvexLocking(fraxLocking)
            .lockedLiquidityOf(address(this));

        // withdraw from lock if it has expired
        unlockedBalance += _unlock(lockedBalance);

        // convert the unlocked Frax Staked Convex LP tokens to to Curve LP tokens
        IFraxConvexStaking(fraxStaking).withdrawAndUnwrap(unlockedBalance);
    }

    /**
     * @notice Anyone can extend the lock for 7 days.
     * This will revert if the Frax Staking contract has been paused.
     */
    function extendLock() external {
        require(
            lockKey > 0 && block.timestamp > unlockTimestamp,
            "Lock not expired"
        );

        // Get the strategy's balance of Frax Staked Convex LP tokens that are NOT locked
        uint256 unlockedBalance = IERC20(fraxStaking).balanceOf(address(this));
        // Get the strategy's balance of Frax Staked Convex LP tokens that are locked
        uint256 lockedBalance = IFraxConvexLocking(fraxLocking)
            .lockedLiquidityOf(address(this));

        // Unlock all if the locked balance is over the target lock balance and the lock has expired
        unlockedBalance += _unlock(lockedBalance);

        // lock any excess unlocked tokens if under the locked target
        _lock(unlockedBalance, lockedBalance);
    }

    /**
     * @dev Approve the Convex Depositor contract to transfer Curve LP tokens
     * from this strategy contract.
     */
    function _approveBase() internal override {
        IERC20 curveLpToken = IERC20(CURVE_LP_TOKEN);
        // Approve the Frax Staking Wrapper to transfer the Curve pool's LP token
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

            // Scale the value down if the asset has less than 18 decimals. eg USDC or USDT
            // and divide by the number of assets in the Curve pool. eg 3 for the 3Pool
            // An average is taken to prevent the balances being manipulated by tilting the Curve pool.
            // No matter what the balance of the asset in the Curve pool is, the value of each asset will
            // be the average of the Curve pool's total value.
            // _getAssetDecimals will revert if _asset is an invalid asset.
            balance = value / CURVE_POOL_ASSETS_COUNT;
        }
    }

    /**
     * @dev Collect accumulated CRV, CVX and FXS rewards and send to Harvester.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // Collect CRV, CVX and FXS rewards
        IFraxConvexStaking(fraxStaking).getReward(address(this));

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
