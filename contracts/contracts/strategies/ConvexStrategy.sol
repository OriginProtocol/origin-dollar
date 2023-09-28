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
import { Helpers } from "../utils/Helpers.sol";

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
    address private _deprecatedCvxDepositorAddress;
    // slither-disable-next-line constable-states
    address private _deprecatedCvxRewardStakerAddress;
    // slither-disable-next-line constable-states
    address private _deprecated_cvxRewardTokenAddress;
    // slither-disable-next-line constable-states
    uint256 private _deprecatedCvxDepositorPTokenId;

    address public immutable cvxDepositor;
    address public immutable cvxRewardStaker;
    uint256 public immutable cvxDepositorPoolId;

    struct ConvexConfig {
        address cvxDepositorAddress;
        address cvxRewardStakerAddress;
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
        cvxDepositor = _convexConfig.cvxDepositorAddress;
        cvxRewardStaker = _convexConfig.cvxRewardStakerAddress;
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
            _assets.length == CURVE_BASE_ASSETS,
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
        // Deposit with staking
        bool success = IConvexDeposits(cvxDepositor).deposit(
            cvxDepositorPoolId,
            IERC20(CURVE_LP_TOKEN).balanceOf(address(this)),
            true
        );
        require(success, "Failed to deposit to Convex");
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
            true
        );
    }

    function _lpWithdrawAll() internal override {
        // withdraw and unwrap with claim takes back the lpTokens and also collects the rewards to this
        IRewardStaking(cvxRewardStaker).withdrawAndUnwrap(
            IRewardStaking(cvxRewardStaker).balanceOf(address(this)),
            true
        );
    }

    function _approveBase() internal override {
        IERC20 curveLpToken = IERC20(CURVE_LP_TOKEN);
        // Approve the Convex deposit contract to transfer the Curve pool's LP token
        curveLpToken.safeApprove(cvxDepositor, 0);
        curveLpToken.safeApprove(cvxDepositor, type(uint256).max);
    }

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        public
        view
        override
        returns (uint256 balance)
    {
        require(assetToPToken[_asset] != address(0), "Unsupported asset");
        // LP tokens in this contract. This should generally be nothing as we
        // should always stake the full balance in the Gauge, but include for
        // safety
        uint256 curveLpToken = IERC20(CURVE_LP_TOKEN).balanceOf(address(this));
        uint256 stakedLpToken = IRewardStaking(cvxRewardStaker).balanceOf(
            address(this)
        );
        uint256 totalCurveLpToken = curveLpToken + stakedLpToken;

        if (totalCurveLpToken > 0) {
            uint256 virtual_price = ICurvePool(CURVE_POOL).get_virtual_price();
            uint256 value = (totalCurveLpToken * virtual_price) / 1e18;
            uint256 assetDecimals = Helpers.getDecimals(_asset);
            balance = value.scaleBy(assetDecimals, 18) / 3;
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
