// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Curve Convex Strategy
 * @notice Investment strategy for investing in base Curve pools with two assets. eg frxETH/WETH
 * @dev There are a number of restrictions on which Curve pools can be used by this strategy
 * - all assets have the same decimals as the Curve pool's LP token. eg 18
 * - the Curve pool and Curve pool LP token are the same contract. This is true for
 * newer Curve pools but not older pools like 3Pool.
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICurveMetaPool } from "./ICurveMetaPool.sol";
import { IRewardStaking } from "./IRewardStaking.sol";
import { IConvexDeposits } from "./IConvexDeposits.sol";
import { IERC20, BaseTwoAssetCurveStrategy, InitializableAbstractStrategy } from "./BaseTwoAssetCurveStrategy.sol";

contract ConvexTwoAssetStrategy is BaseTwoAssetCurveStrategy {
    using SafeERC20 for IERC20;

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
        ConvexConfig memory _convexConfig
    ) InitializableAbstractStrategy(_stratConfig) {
        cvxDepositor = _convexConfig.cvxDepositorAddress;
        cvxRewardStaker = _convexConfig.cvxRewardStakerAddress;
        cvxDepositorPoolId = _convexConfig.cvxDepositorPoolId;
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of CRV & CVX
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the Curve pool contract, i.e.
     *                frxETH, WETH
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // CRV + CVX
        address[] calldata _assets
    ) external onlyGovernor initializer {
        require(
            _assets.length == CURVE_BASE_ASSETS,
            "Invalid number of base assets"
        );

        address[] memory pTokens = new address[](CURVE_BASE_ASSETS);
        pTokens[0] = platformAddress;
        pTokens[1] = platformAddress;

        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            pTokens
        );
        _approveBase();
    }

    function _lpDepositAll() internal override {
        IERC20 curveLp = IERC20(platformAddress);
        // Deposit with staking
        bool success = IConvexDeposits(cvxDepositor).deposit(
            cvxDepositorPoolId,
            curveLp.balanceOf(address(this)),
            true
        );
        require(success, "Failed to deposit to Convex");
    }

    function _lpWithdraw(uint256 requiredLpTokens) internal override {
        uint256 actualLpTokens = IRewardStaking(cvxRewardStaker).balanceOf(
            address(this)
        );

        // Not enough Curve LP tokens in this contract or Convex pool, can't proceed
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
        IERC20 pToken = IERC20(platformAddress);
        // approve the Convex deposit contract to transfer the Curve pool's LP token
        pToken.safeApprove(cvxDepositor, 0);
        pToken.safeApprove(cvxDepositor, type(uint256).max);
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
        uint256 contractPTokens = IERC20(platformAddress).balanceOf(
            address(this)
        );
        uint256 gaugePTokens = IRewardStaking(cvxRewardStaker).balanceOf(
            address(this)
        );
        uint256 totalPTokens = contractPTokens + gaugePTokens;

        ICurveMetaPool curvePool = ICurveMetaPool(platformAddress);
        if (totalPTokens > 0) {
            uint256 virtual_price = curvePool.get_virtual_price();
            uint256 value = (totalPTokens * virtual_price) / 1e18;
            balance = value / CURVE_BASE_ASSETS;
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
