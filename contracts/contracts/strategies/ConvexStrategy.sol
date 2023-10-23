// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Curve Convex Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
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
contract ConvexStrategy is BaseCurveStrategy {
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
        address cvxRewardStaker;
        uint256 cvxDepositorPoolId;
    }

    constructor(
        BaseStrategyConfig memory _stratConfig,
        CurveConfig memory _curveConfig,
        ConvexConfig memory _convexConfig
    )
        InitializableAbstractStrategy(_stratConfig)
        BaseCurveStrategy(_curveConfig)
    {
        cvxDepositor = _convexConfig.cvxDepositor;
        cvxRewardStaker = _convexConfig.cvxRewardStaker;
        cvxDepositorPoolId = _convexConfig.cvxDepositorPoolId;
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

    function _lpDepositAll() internal override {
        // Deposit the Curve LP tokens into the Convex pool and stake
        require(
            IConvexDeposits(cvxDepositor).deposit(
                cvxDepositorPoolId,
                IERC20(CURVE_LP_TOKEN).balanceOf(address(this)),
                true // stake
            ),
            "Failed to deposit to Convex"
        );
    }

    function _lpWithdraw(uint256 requiredLpTokens) internal override {
        uint256 actualLpTokens = IRewardStaking(cvxRewardStaker).balanceOf(
            address(this)
        );

        // Not enough Curve LP tokens in this contract or the Convex pool, can't proceed
        require(
            requiredLpTokens < actualLpTokens,
            "Insufficient Curve LP balance"
        );

        // withdraw and unwrap with claim takes back the lpTokens and also collects the rewards to this
        IRewardStaking(cvxRewardStaker).withdrawAndUnwrap(
            requiredLpTokens,
            true // stake
        );
    }

    function _lpWithdrawAll() internal override {
        // withdraw and unwrap with claim takes back the lpTokens and also collects the rewards to this
        IRewardStaking(cvxRewardStaker).withdrawAndUnwrap(
            IRewardStaking(cvxRewardStaker).balanceOf(address(this)),
            true // stake
        );
    }

    function _approveBase() internal override {
        IERC20 curveLpToken = IERC20(CURVE_LP_TOKEN);
        // Approve the Convex deposit contract to transfer the Curve pool's LP token
        curveLpToken.safeApprove(cvxDepositor, 0);
        curveLpToken.safeApprove(cvxDepositor, type(uint256).max);
    }

    /**
     * @notice Get the asset's share of value held in the strategy. This is the total value
     * of the stategy's Curve LP tokens divided by the number of Curve pool assets.
     * @dev An invalid asset will fail in _getAssetDecimals with "Unsupported asset"
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
            // Calculate the value of the Curve LP tokens in USD or ETH
            uint256 value = (totalLpToken *
                ICurvePool(CURVE_POOL).get_virtual_price()) / 1e18;

            // Scale the value down if the asset has less than 18 decimals. eg USDC or USDT
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
