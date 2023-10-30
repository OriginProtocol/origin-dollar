// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Abstract Convex Automated Market Maker (AMO) Strategy
 * @notice Investment strategy for investing assets in Curve and Convex pools
 * @author Origin Protocol Inc
 */
import { BaseAMOStrategy, InitializableAbstractStrategy } from "./BaseAMOStrategy.sol";
import { ICurveETHPoolV1 } from "../curve/ICurveETHPoolV1.sol";
import { IConvexDeposits } from "../IConvexDeposits.sol";
import { IRewardStaking } from "../IRewardStaking.sol";

abstract contract BaseConvexAMOStrategy is BaseAMOStrategy {
    // New immutable variables that must be set in the constructor
    address public immutable cvxDepositorAddress;
    IRewardStaking public immutable cvxRewardStaker;
    uint256 public immutable cvxDepositorPTokenId;
    /// @notice The Curve pool that the strategy invests in
    ICurveETHPoolV1 public immutable curvePool;

    // Used to circumvent the stack too deep issue
    struct ConvexConfig {
        address cvxDepositorAddress; // Address of the Convex depositor(AKA booster) for this pool
        address cvxRewardStakerAddress; // Address of the CVX rewards staker
        uint256 cvxDepositorPTokenId; // Pid of the pool referred to by Depositor and staker
    }

    constructor(
        BaseStrategyConfig memory _baseConfig,
        AMOConfig memory _amoConfig,
        ConvexConfig memory _convexConfig
    ) BaseAMOStrategy(_baseConfig, _amoConfig) {
        // Is the AMO pool contract. eg OETH/ETH, OUSD/3CRV or OETH/frxETH
        curvePool = ICurveETHPoolV1(_baseConfig.platformAddress);

        cvxDepositorAddress = _convexConfig.cvxDepositorAddress;
        cvxRewardStaker = IRewardStaking(_convexConfig.cvxRewardStakerAddress);
        cvxDepositorPTokenId = _convexConfig.cvxDepositorPTokenId;
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of reward tokens CRV & CVX
     */
    function initialize(
        address[] calldata _rewardTokenAddresses,
        address[] calldata _assets,
        address[] calldata _pTokens
    ) external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );

        _approveBase();
    }

    /***************************************
                Curve Pool
    ****************************************/

    /// @dev Adds pool assets (3CRV, frxETH or ETH) and/or OTokens (OUSD or OETH) to the Curve pool
    /// @param poolAmounts The amount of Curve pool assets to add to the pool
    /// @param minLpAmount The minimum amount of Curve pool LP tokens that is acceptable to receive
    function _addLiquidityToPool(
        uint256[2] memory poolAmounts,
        uint256 minLpAmount
    ) internal override returns (uint256 lpDeposited) {
        lpDeposited = curvePool.add_liquidity(poolAmounts, minLpAmount);
    }

    /// @dev Removes pool assets and/or OTokens from the Curve pool
    /// @param lpTokens The amount of Curve pool LP tokens to be burnt
    /// @param minPoolAssetAmounts The minimum amount of AMO pool assets that are acceptable to receive
    function _removeLiquidityFromPool(
        uint256 lpTokens,
        uint256[2] memory minPoolAssetAmounts
    ) internal override {
        // slither-disable-next-line unused-return
        curvePool.remove_liquidity(lpTokens, minPoolAssetAmounts);
    }

    /// @dev Removes either pool assets or OTokens from the Curve pool.
    /// @param poolAsset The address of the Curve pool asset to be removed. eg OETH, OUSD, ETH, 3CRV, frxETH
    /// @param lpTokens The amount of Curve pool LP tokens to be burnt
    /// @param minPoolAssetAmount The minimum amount of Curve pool assets that are acceptable to receive. eg OETH or ETH
    function _removeOneSidedLiquidityFromPool(
        address poolAsset,
        uint256 lpTokens,
        uint256 minPoolAssetAmount
    ) internal override returns (uint256 coinsRemoved) {
        uint128 coinIndex = _getCoinIndex(poolAsset);

        // Remove only one asset from the Curve pool
        coinsRemoved = curvePool.remove_liquidity_one_coin(
            lpTokens,
            int128(coinIndex),
            minPoolAssetAmount,
            address(this)
        );
    }

    /// @dev Returns the current balances of the Curve pool
    function _getBalances()
        internal
        view
        override
        returns (uint256[2] memory balances)
    {
        balances = curvePool.get_balances();
    }

    /// @dev Returns the current balances of the Curve pool
    function _getBalance(address poolAsset)
        internal
        view
        override
        returns (uint256 balance)
    {
        uint128 coinIndex = _getCoinIndex(poolAsset);
        balance = curvePool.balances(uint128(coinIndex));
    }

    /// @dev Returns the price of one Curve pool LP token in base asset terms.
    function _getVirtualPrice()
        internal
        view
        override
        returns (uint256 virtualPrice)
    {
        virtualPrice = curvePool.get_virtual_price();
    }

    /***************************************
                Convex Reward Pool
    ****************************************/

    /// @dev Deposit the AMO pool LP tokens to the rewards pool.
    /// eg Curve LP tokens into Convex or Balancer LP tokens into Aura
    function _stakeCurveLp(uint256 lpDeposited) internal override {
        require(
            IConvexDeposits(cvxDepositorAddress).deposit(
                cvxDepositorPTokenId,
                lpDeposited,
                true // Deposit with staking
            ),
            "Failed to Deposit LP to Convex"
        );
    }

    /// @dev Withdraw a specific amount of AMO pool LP tokens from the rewards pool
    /// eg Curve LP tokens from Convex or Balancer LP tokens from Aura
    function _unStakeLpTokens(uint256 _lpAmount) internal override {
        // withdraw and unwrap with claim takes back the lpTokens.
        // Do not collect any reward tokens as that will be done via the harvester
        cvxRewardStaker.withdrawAndUnwrap(_lpAmount, false);
    }

    /// @dev Withdraw all AMO pool LP tokens from the rewards pool
    function _unStakeAllLpTokens() internal override {
        uint256 gaugeTokens = cvxRewardStaker.balanceOf(address(this));
        // withdraw and unwrap with claim takes back the lpTokens.
        // Do not collect any reward tokens as that will be done via the harvester
        cvxRewardStaker.withdrawAndUnwrap(gaugeTokens, false);
    }

    /**
     * @notice Collect accumulated CRV and CVX rewards and send to the Harvester.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // Collect CRV and CVX
        cvxRewardStaker.getReward();
        _collectRewardTokens();
    }
}
