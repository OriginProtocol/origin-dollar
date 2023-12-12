// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Curve Convex Strategy
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
import { IRewardStaking } from "./IRewardStaking.sol";
import { IConvexDeposits } from "./IConvexDeposits.sol";
import { IERC20, BaseCurveStrategy, InitializableAbstractStrategy } from "./BaseCurveStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";

/*
 * IMPORTANT(!) If ConvexStrategy needs to be re-deployed, it requires new
 * proxy contract with fresh storage slots. Changes in `BaseCurveStrategy`
 * storage slots would break existing implementation.
 *
 * Remove this notice if ConvexStrategy is re-deployed
 */
abstract contract ConvexStrategy is BaseCurveStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    // slither-disable-next-line constable-states
    address private _deprecated_CvxDepositorAddress;
    // slither-disable-next-line constable-states
    address private _deprecated_CvxRewardStakerAddress;
    // slither-disable-next-line constable-states
    address private _deprecated_cvxRewardTokenAddress;
    // slither-disable-next-line constable-states
    uint256 private _deprecated_CvxDepositorPTokenId;

    /// @notice Convex deposit contract
    address public immutable cvxDepositor;
    /// @notice Convex contract that holds the staked Curve LP tokens
    address public immutable cvxRewardStaker;
    /// @notice Convex pool identifier
    uint256 public immutable cvxDepositorPoolId;

    struct ConvexConfig {
        address cvxDepositor;
        uint256 cvxDepositorPoolId;
    }

    constructor(ConvexConfig memory _convexConfig) {
        cvxDepositor = _convexConfig.cvxDepositor;
        cvxDepositorPoolId = _convexConfig.cvxDepositorPoolId;

        // Get the Convex Rewards contract for the Convex pool
        // slither-disable-next-line unused-return
        (, , , cvxRewardStaker, , ) = IConvexDeposits(
            _convexConfig.cvxDepositor
        ).poolInfo(_convexConfig.cvxDepositorPoolId);
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
     * @dev deposit the Curve LP tokens into the Convex pool and
     * stake the Convex LP tokens.
     *
     * This will revert if the Convex pool has been shut down.
     */
    function _lpDepositAll() internal override {
        // Deposit the Curve LP tokens into the Convex pool and stake.
        require(
            IConvexDeposits(cvxDepositor).deposit(
                cvxDepositorPoolId,
                IERC20(CURVE_LP_TOKEN).balanceOf(address(this)),
                true // stake
            ),
            "Failed to deposit to Convex"
        );
    }

    /**
     * @dev Unstake a required amount of Convex LP token and withdraw the Curve LP tokens from the Convex pool.
     * This assumes 1 Convex LP token equals 1 Curve LP token.
     * Do not collect Convex token rewards (CRV and CVX) as that's done via the Harvester.
     * Collecting token rewards now just adds extra gas as they will sit in the strategy until
     * the Harvester collects more rewards and swaps them for a vault asset.
     *
     * This will NOT revert if the Convex pool has been shut down.
     */
    function _lpWithdraw(uint256 requiredLpTokens) internal override {
        // Get the actual amount of Convex LP tokens staked.
        uint256 actualLpTokens = IRewardStaking(cvxRewardStaker).balanceOf(
            address(this)
        );

        // Not enough Curve LP tokens in this contract or the Convex pool, can't proceed
        require(
            requiredLpTokens < actualLpTokens,
            "Insufficient Curve LP balance"
        );

        // Unstake the Convex LP token and withdraw the Curve LP tokens from the Convex pool to this strategy contract.
        IRewardStaking(cvxRewardStaker).withdrawAndUnwrap(
            requiredLpTokens,
            false // do not claim Convex token rewards
        );
    }

    /**
     * @dev Unstake all the Convex LP tokens and withdraw all the Curve LP tokens from the Convex pool.
     * Do not collect Convex token rewards (CRV and CVX) as that's done via the Harvester.
     * Collecting token rewards now just adds extra gas as they will sit in the strategy until
     * the Harvester collects more rewards and swaps them for a vault asset.
     *
     * This will NOT revert if the Convex pool has been shut down.
     */
    function _lpWithdrawAll() internal override {
        // Unstake all the Convex LP token and withdraw all the Curve LP tokens
        // from the Convex pool to this strategy contract.
        IRewardStaking(cvxRewardStaker).withdrawAndUnwrap(
            IRewardStaking(cvxRewardStaker).balanceOf(address(this)),
            false // do not claim Convex token rewards
        );
    }

    /**
     * @dev Approve the Convex Depositor contract to transfer Curve LP tokens
     * from this strategy contract.
     */
    function _approveBase() internal override {
        IERC20 curveLpToken = IERC20(CURVE_LP_TOKEN);
        // Approve the Convex deposit contract to transfer the Curve pool's LP token
        // slither-disable-next-line unused-return
        curveLpToken.approve(cvxDepositor, type(uint256).max);
    }

    /**
     * @notice Get the asset's share of Curve LP value controlled by this strategy. This is the total value
     * of the Curve LP tokens staked in Convex and held in this strategy contract
     * divided by the number of Curve pool assets.
     * The average is taken prevent the asset balances being manipulated by tilting the Curve pool.
     * @dev An invalid `_asset` will fail in `_getAssetDecimals` with "Unsupported asset"
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        public
        view
        override
        returns (uint256 balance)
    {
        // Curve LP tokens in this contract. This should generally be nothing as we
        // should always stake the full balance in the Gauge, but include for
        // safety
        uint256 contractLpTokens = IERC20(CURVE_LP_TOKEN).balanceOf(
            address(this)
        );

        // Get the Curve LP tokens staked in the Convex pool.
        uint256 convexLpTokens = IRewardStaking(cvxRewardStaker).balanceOf(
            address(this)
        );
        uint256 totalLpToken = contractLpTokens + convexLpTokens;

        if (totalLpToken > 0) {
            // get_virtual_price is gas intensive, so only call it if we have LP tokens.
            // Convert the Curve LP tokens controlled by this strategy to a value in USD or ETH
            uint256 value = (totalLpToken *
                ICurvePool(CURVE_POOL).get_virtual_price()) / 1e18;

            // Scale the value down if the asset has less than 18 decimals. eg USDC or USDT
            // and divide by the number of assets in the Curve pool. eg 3 for the 3Pool
            // An average is taken to prevent the balances being manipulated by tilting the Curve pool.
            // No matter what the balance of the asset in the Curve pool is, the value of each asset will
            // be the average of the Curve pool's total value.
            // _getAssetDecimals will revert if _asset is an invalid asset.
            balance =
                value.scaleBy(_getAssetDecimals(_asset), 18) /
                CURVE_POOL_ASSETS_COUNT;
        }
    }

    /**
     * @dev Collect accumulated CRV and CVX and send to Vault.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // Collect CRV and CVX
        IRewardStaking(cvxRewardStaker).getReward();
        _collectRewardTokens();
    }
}
