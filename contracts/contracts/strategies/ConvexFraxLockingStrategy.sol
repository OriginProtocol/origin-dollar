// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Convex Convex Frax Locking Strategy
 * @notice Investment strategy for investing Curve Liquidity Provider (LP) tokens in Convex pools.
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
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICurvePool } from "./curve/ICurvePool.sol";
import { IFraxConvexStaking } from "../interfaces/IFraxConvexStaking.sol";
import { IFraxConvexStakingWrapper } from "../interfaces/IFraxConvexStakingWrapper.sol";
import { IERC20, BaseCurveStrategy, InitializableAbstractStrategy } from "./BaseCurveStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";

abstract contract ConvexFraxLockingStrategy is BaseCurveStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    /// @notice The number of seconds to lock Frax Staked Convex LP tokens for.
    /// 7 days is the minimum to get token rewards.
    uint256 constant LOCK_DURATION = 7 days + 1;

    /// @notice Frax Staking Wrapper for Convex
    /// @dev Has deposit, withdrawAndUnwrap and getReward functions
    address public immutable fraxStakingWrapper;
    /// @notice Frax Staking for Convex that holds the locked liquidity
    /// @dev Has lockedLiquidityOf function
    address public immutable fraxStaking;

    /// @notice The key of locked Frax Staked Convex LP tokens. eg locked stkcvxfrxeth-ng-f-frax
    bytes32 lockKey;
    /// @notice The UNIX timestamp in seconds when the lock expires
    uint64 unlockTimestamp;

    /// @notice The number of Curve LP tokens that are pending redemption
    uint128 pendingRedeemRequest;

    struct ConvexConfig {
        address fraxStakingWrapper;
        address fraxStaking;
    }

    constructor(ConvexConfig memory _convexConfig) {
        fraxStakingWrapper = _convexConfig.fraxStakingWrapper;
        fraxStaking = _convexConfig.fraxStaking;
    }

    /**
     * Initializer for setting up strategy internal state.
     * @param _rewardTokenAddresses Address of CRV & CVX
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                DAI, USDC, USDT
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // CRV + CVX
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

    /**
     * @dev Deposit and lock the Curve LP tokens into the Frax Staking contract for a Convex pool.
     *
     * This will revert if the Frax Staking contract or Convex pool has been shut down.
     */
    function _lpDepositAll() internal override {
        // Get the Curve LP tokens in this strategy
        uint256 curveLpBalance = IERC20(CURVE_LP_TOKEN).balanceOf(
            address(this)
        );

        // Deposit all the Curve LP tokens into the Frax Staking contract for Convex pools
        // to receive Frax Staked Convex LP tokens. eg deposit frxeth-ng-f for stkcvxfrxeth-ng-f-frax
        IFraxConvexStakingWrapper(fraxStakingWrapper).deposit(
            curveLpBalance,
            address(this)
        );

        if (pendingRedeemRequest >= curveLpBalance) {
            // There is not enough Curve LP tokens to cover the pending redeem request
            // so will not add more tokens or time to the existing lock.
            // Nothing else to do here.
            return;
        }

        // The amount of Curve LP tokens to lock is the balance minus the pending redeem request
        // pendingRedeemRequest < curveLpBalance
        uint256 curveLpToLock = curveLpBalance - pendingRedeemRequest;

        if (lockKey == bytes32(0)) {
            // Lock the Frax Staked Convex LP tokens for the required duration
            // eg lock stkcvxfrxeth-ng-f-frax for 7 days
            lockKey = IFraxConvexStaking(fraxStaking).stakeLocked(
                curveLpToLock,
                LOCK_DURATION
            );
        } else {
            // Add Frax Staked Convex LP tokens to the existing lock.
            // Add even if the lock has expired as we'll extend the lock next if needed.
            // eg add stkcvxfrxeth-ng-f-frax to the existing lock
            IFraxConvexStaking(fraxStaking).lockAdditional(
                lockKey,
                curveLpToLock
            );

            // if the lock has expired
            if (unlockTimestamp < block.timestamp) {
                // Extend the lock for 7 days
                IFraxConvexStaking(fraxStaking).lockLonger(
                    lockKey,
                    block.timestamp + LOCK_DURATION
                );
            }
        }

        // Record when the lock expires
        unlockTimestamp = uint64(block.timestamp + LOCK_DURATION);
    }

    /**
     * @dev
     *
     * This will NOT revert if the Convex pool has been shut down.
     */
    function _lpWithdraw(uint256 requiredCurveLpTokens) internal override {
        // Get the strategy's balance of Frax Staked Convex LP tokens that are not locked
        uint256 unlockedFraxStakedConvexLPs = IERC20(fraxStakingWrapper)
            .balanceOf(address(this));

        // If the require Curve LP tokens is greater than the unlocked Frax Staked Convex LP tokens
        if (requiredCurveLpTokens > unlockedFraxStakedConvexLPs) {
            require(block.timestamp > unlockTimestamp, "Lock not expired");

            // Withdraw all the locked Frax Staked Convex LP tokens for the lock
            // to this strategy contract and do not claim rewards.
            // Add the amount withdrawn to the unlocked Frax Staked Convex LP tokens
            unlockedFraxStakedConvexLPs += IFraxConvexStaking(
                fraxStakingWrapper
            ).withdrawLocked(lockKey, address(this), false);
        }

        require(
            requiredCurveLpTokens <= unlockedFraxStakedConvexLPs,
            "Not enough unlocked"
        );

        IFraxConvexStakingWrapper(fraxStakingWrapper).withdrawAndUnwrap(
            requiredCurveLpTokens
        );

        pendingRedeemRequest -= uint128(requiredCurveLpTokens);
    }

    /**
     * @dev
     *
     * This will NOT revert if the Convex pool has been shut down.
     */
    function _lpWithdrawAll() internal override {
        // If the locked Frax Staked Convex LP tokens have expired
        if (block.timestamp > unlockTimestamp) {
            // Withdraw all the Frax Staked Convex LP tokens for the lock
            // to this strategy contract and do not claim rewards
            IFraxConvexStaking(fraxStakingWrapper).withdrawLocked(
                lockKey,
                address(this),
                false
            );
        }

        // Get the strategy's balance of Frax Staked Convex LP tokens that are not locked
        uint256 fraxStakedConvexLPs = IERC20(fraxStakingWrapper).balanceOf(
            address(this)
        );

        IFraxConvexStakingWrapper(fraxStakingWrapper).withdrawAndUnwrap(
            fraxStakedConvexLPs
        );

        pendingRedeemRequest = pendingRedeemRequest > fraxStakedConvexLPs
            ? pendingRedeemRequest - uint128(fraxStakedConvexLPs)
            : 0;
    }

    /**
     * @notice Anyone can extend the lock for 7 days.
     * This will revert if the Frax Staking contract has been paused.
     * This will NOT revert if the Convex pool has been shut down??
     */
    function extendLock() external {
        require(block.timestamp > unlockTimestamp, "Lock not expired");

        // Get the strategy's balance of Frax Staked Convex LP tokens that are not locked
        uint256 unlockedFraxStakedConvexLPs = IERC20(fraxStakingWrapper)
            .balanceOf(address(this));

        // If not enough Frax Staked Convex LP tokens are unlocked to cover the pending redeem request
        if (pendingRedeemRequest >= unlockedFraxStakedConvexLPs) {
            // Withdraw all the Frax Staked Convex LP tokens for the lock
            // to this strategy contract and do not claim rewards
            // Add to the unstaked Frax Staked Convex LP tokens
            unlockedFraxStakedConvexLPs += IFraxConvexStaking(
                fraxStakingWrapper
            ).withdrawLocked(lockKey, address(this), false);

            // The previous withdraw all deletes the old lock
            lockKey = bytes32(0);
        }

        // If we have more unlocked Frax Staked Convex LP tokens than required for the pending redeem request.
        if (unlockedFraxStakedConvexLPs > pendingRedeemRequest) {
            // Calculate how much Frax Staked Convex LP tokens to lock
            uint256 lpTokensToLock = unlockedFraxStakedConvexLPs -
                pendingRedeemRequest;

            // Relock the Frax Staked Convex LP tokens for the required duration to a new lock.
            // eg lock stkcvxfrxeth-ng-f-frax for 7 days
            lockKey = IFraxConvexStaking(fraxStaking).stakeLocked(
                lpTokensToLock,
                LOCK_DURATION
            );
        }

        // Extend the lock for 7 days
        IFraxConvexStaking(fraxStaking).lockLonger(
            lockKey,
            block.timestamp + LOCK_DURATION
        );

        // Record when the lock expires
        unlockTimestamp = uint64(block.timestamp + LOCK_DURATION);
    }

    /**
     * @dev Approve the Convex Depositor contract to transfer Curve LP tokens
     * from this strategy contract.
     */
    function _approveBase() internal override {
        IERC20 curveLpToken = IERC20(CURVE_LP_TOKEN);
        // Approve the Frax Staking Wrapper to transfer the Curve pool's LP token
        // slither-disable-next-line unused-return
        curveLpToken.approve(fraxStakingWrapper, type(uint256).max);
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
    function checkBalance(
        address _asset
    ) public view override returns (uint256 balance) {
        require(_curveSupportedCoin(_asset), "Unsupported asset");

        // Curve LP tokens in this contract. This should generally be nothing as we
        // should always stake in the Frax Staking contract.
        uint256 curveLpTokens = IERC20(CURVE_LP_TOKEN).balanceOf(address(this));

        // Get the strategy's balance of Frax Staked Convex LP tokens that are not locked
        // This will be if there's a pending redeem request.
        curveLpTokens += IERC20(fraxStakingWrapper).balanceOf(address(this));

        // Get the strategy's locled Frax Staked Convex LP tokens
        curveLpTokens += IFraxConvexStaking(fraxStaking).lockedLiquidityOf(
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
        IFraxConvexStakingWrapper(fraxStakingWrapper).getReward(address(this));

        // Transfer each of the rewards to the Harvester
        _collectRewardTokens();
    }
}
