// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Abstract Aura Automated Market Maker (AMO) Strategy
 * @notice Investment strategy for investing assets in Balancer and Aura pools
 * @author Origin Protocol Inc
 */
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { BaseAMOStrategy, InitializableAbstractStrategy } from "./BaseAMOStrategy.sol";
import { ICurveETHPoolV1 } from "../ICurveETHPoolV1.sol";
import { IConvexDeposits } from "../IConvexDeposits.sol";
import { IRewardStaking } from "../IRewardStaking.sol";
import { IBalancerVault } from "../../interfaces/balancer/IBalancerVault.sol";
import { IRateProvider } from "../../interfaces/balancer/IRateProvider.sol";
import { IERC4626 } from "../../../lib/openzeppelin/interfaces/IERC4626.sol";

abstract contract BaseBalancerAMOStrategy is BaseAMOStrategy {
    /// @notice Address of the Balancer vault
    IBalancerVault public immutable balancerVault;
    /// @notice Balancer pool identifier
    bytes32 public immutable balancerPoolId;
    /// @notice Address of the Aura rewards pool
    address public immutable auraRewardPool;

    struct BalancerConfig {
        address balancerVault; // Address of the Balancer vault
        bytes32 balancerPoolId; // Balancer pool identifier
        address auraRewardPool; // Address of the Aura rewards pool
    }

    constructor(
        BaseStrategyConfig memory _baseConfig,
        AMOConfig memory _amoConfig,
        BalancerConfig memory _balancerConfig
    ) BaseAMOStrategy(_baseConfig, _amoConfig) {
        balancerVault = IBalancerVault(_balancerConfig.balancerVault);
        balancerPoolId = _balancerConfig.balancerPoolId;
        auraRewardPool = _balancerConfig.auraRewardPool;
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of CRV & CVX
     */
    function initialize(
        address[] calldata _rewardTokenAddresses // CRV + CVX
    ) external onlyGovernor initializer {
        address[] memory assets = new address[](1);
        assets[0] = address(asset);
        // pTokens are not used by this strategy
        // it is only included for backward compatibility with the
        // parent InitializableAbstractStrategy contract
        address[] memory pTokens = new address[](1);
        pTokens[0] = address(balancerVault);

        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            assets,
            pTokens
        );

        _approveBase();
    }

    /***************************************
                Balancer Pool
    ****************************************/

    /// @dev Adds ETH and/or OETH to the Curve pool
    /// @param poolAmounts The amount of Balancer pool assets and OTokens to add to the pool
    function _addLiquidityToPool(
        uint256[2] memory poolAmounts,
        uint256 minMintAmount
    ) internal override returns (uint256 lpDeposited) {
        // TODO do we need to check if the tokens in the pool have changed?
        (IERC20[] memory tokens, , ) = balancerVault.getPoolTokens(
            balancerPoolId
        );
        require(tokens[oTokenCoinIndex] == oToken, "Invalid Balancer oToken");
        require(tokens[assetCoinIndex] == asset, "Invalid Balancer asset");

        uint256[] memory amountsIn = new uint256[](tokens.length);
        amountsIn[oTokenCoinIndex] = poolAmounts[oTokenCoinIndex];
        amountsIn[assetCoinIndex] = poolAmounts[assetCoinIndex];

        address[] memory poolAssets = new address[](tokens.length);
        poolAssets[oTokenCoinIndex] = address(oToken);
        poolAssets[assetCoinIndex] = address(asset);

        /* EXACT_TOKENS_IN_FOR_BPT_OUT:
         * User sends precise quantities of tokens, and receives an
         * estimated but unknown (computed at run time) quantity of BPT.
         *
         * ['uint256', 'uint256[]', 'uint256']
         * [EXACT_TOKENS_IN_FOR_BPT_OUT, amountsIn, minimumBPT]
         */
        bytes memory userData = abi.encode(
            IBalancerVault.WeightedPoolJoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT,
            amountsIn,
            minMintAmount
        );

        IBalancerVault.JoinPoolRequest memory request = IBalancerVault
            .JoinPoolRequest(poolAssets, amountsIn, userData, false);

        // Add the pool assets in this strategy to the balancer pool
        balancerVault.joinPool(
            balancerPoolId,
            address(this),
            address(this),
            request
        );

        lpDeposited = lpToken.balanceOf(address(this));
    }

    /// @dev Removes pool assets and/or OTokens from the Balancer pool.
    /// Balancer will withdraw and exact amount of pool assets in exchange for a calculated amount of AMO LP tokens.
    /// @param lpTokens The maximum amount of AMO pool LP tokens to be burnt.
    /// @param poolAssetAmounts The exact amount of AMO pool assets to be removed.
    function _removeLiquidityFromPool(
        uint256 lpTokens,
        uint256[2] memory poolAssetAmounts
    ) internal override {
        uint256[] memory poolAssetsAmountsOut = new uint256[](2);
        poolAssetsAmountsOut[oTokenCoinIndex] = poolAssetAmounts[
            oTokenCoinIndex
        ];
        poolAssetsAmountsOut[assetCoinIndex] = poolAssetAmounts[assetCoinIndex];

        _removeBalancerLiquidity(lpTokens, poolAssetsAmountsOut);
    }

    /// @dev Removes either pool assets or OTokens from the Balancer pool.
    /// Balancer will withdraw and exact amount of pool assets in exchange for a calculated amount of AMO LP tokens.
    /// @param poolAsset The address of the AMO pool asset to be removed. eg OETH or WETH
    /// @param lpTokens The maximum amount of AMO pool LP tokens to be burnt.
    /// @param poolAssetAmount The exact amount of AMO pool assets to be removed.
    function _removeOneSidedLiquidityFromPool(
        address poolAsset,
        uint256 lpTokens,
        uint256 poolAssetAmount
    ) internal override returns (uint256 coinsRemoved) {
        uint128 coinIndex = _getCoinIndex(poolAsset);
        uint256[] memory poolAssetsAmountsOut = new uint256[](2);
        poolAssetsAmountsOut[coinIndex] = poolAssetAmount;

        _removeBalancerLiquidity(lpTokens, poolAssetsAmountsOut);

        // As we are withdrawing and exact amount of pool assets, the amount received
        // is the same as the amount requested.
        coinsRemoved = poolAssetAmount;
    }

    function _removeBalancerLiquidity(
        uint256 lpTokens,
        uint256[] memory poolAssetsAmountsOut
    ) internal {
        // TODO do we need to check if the tokens in the pool have changed?
        (IERC20[] memory tokens, , ) = balancerVault.getPoolTokens(
            balancerPoolId
        );
        require(tokens[oTokenCoinIndex] == oToken, "Invalid Balancer oToken");
        require(tokens[assetCoinIndex] == asset, "Invalid Balancer asset");

        address[] memory poolAssets = new address[](tokens.length);
        poolAssets[oTokenCoinIndex] = address(oToken);
        poolAssets[assetCoinIndex] = address(asset);

        /* Custom asset exit: BPT_IN_FOR_EXACT_TOKENS_OUT:
         * User sends an estimated but unknown (computed at run time) quantity of BPT,
         * and receives precise quantities of specified tokens.
         *
         * ['uint256', 'uint256[]', 'uint256']
         * [BPT_IN_FOR_EXACT_TOKENS_OUT, amountsOut, maxBPTAmountIn]
         */
        bytes memory userData = abi.encode(
            IBalancerVault.WeightedPoolExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT,
            poolAssetsAmountsOut,
            lpTokens
        );
        IBalancerVault.ExitPoolRequest memory request = IBalancerVault
            .ExitPoolRequest(
                poolAssets,
                /* We specify the exact amount of a tokens we are expecting in the encoded
                 * userData, for that reason we don't need to specify the amountsOut here.
                 *
                 * Also Balancer has a rounding issue that can make a transaction fail:
                 * https://github.com/balancer/balancer-v2-monorepo/issues/2541
                 * which is an extra reason why this field is empty.
                 */
                new uint256[](tokens.length),
                userData,
                false
            );
        balancerVault.exitPool(
            balancerPoolId,
            address(this),
            /* Payable keyword is required because of the IBalancerVault interface even though
             * this strategy shall never be receiving native ETH
             */
            payable(address(this)),
            request
        );
    }

    /// @dev Returns the current balances of the AMO pool
    function _getBalances()
        internal
        view
        override
        returns (uint256[2] memory balances)
    {
        // Get all the supported Balancer pool assets and balances
        (IERC20[] memory tokens, uint256[] memory allBalances, ) = balancerVault
            .getPoolTokens(balancerPoolId);
        require(tokens[oTokenCoinIndex] == oToken, "Invalid Balancer oToken");
        require(tokens[assetCoinIndex] == asset, "Invalid Balancer asset");

        balances[oTokenCoinIndex] = allBalances[oTokenCoinIndex];
        balances[assetCoinIndex] = allBalances[assetCoinIndex];
    }

    /// @dev Returns the current balances of the AMO pool
    function _getBalance(address poolAsset)
        internal
        view
        override
        returns (uint256 balance)
    {
        uint128 coinIndex = _getCoinIndex(poolAsset);

        // Get all the supported Balancer pool assets and balances
        (IERC20[] memory tokens, uint256[] memory allBalances, ) = balancerVault
            .getPoolTokens(balancerPoolId);
        require(tokens[coinIndex] == asset, "Invalid Balancer index");

        balance = allBalances[coinIndex];
    }

    /// @dev Returns the price of one AMO pool LP token in base asset terms.
    function _getVirtualPrice()
        internal
        view
        override
        returns (uint256 virtualPrice)
    {
        virtualPrice = IRateProvider(address(lpToken)).getRate();
    }

    /***************************************
                Aura Reward Pool
    ****************************************/

    /// @dev Deposit the AMO pool LP tokens to the rewards pool.
    /// eg Curve LP tokens into Convex or Balancer LP tokens into Aura
    function _stakeCurveLp(uint256 lpAmount) internal override {
        uint256 lpDeposited = IERC4626(auraRewardPool).deposit(
            lpAmount,
            address(this)
        );
        require(lpAmount == lpDeposited, "Aura LP != BPT");
    }

    /**
     * @dev Withdraw `_lpAmount` Balancer Pool Tokens (BPT) from
     * the Aura rewards pool to this strategy contract.
     * @param _lpAmount Number of Balancer Pool Tokens (BPT) to withdraw
     */
    function _unStakeLpTokens(uint256 _lpAmount) internal override {
        IRewardStaking(auraRewardPool).withdrawAndUnwrap(
            _lpAmount,
            true // also claim reward tokens
        );
    }

    /**
     * @dev Withdraw all Balancer Pool Tokens (BPT) from
     * the Aura rewards pool to this strategy contract.
     */
    function _unStakeAllLpTokens() internal override {
        // Get all the strategy's BPTs in Aura
        // maxRedeem is implemented as balanceOf(address) in Aura
        uint256 bptBalance = IERC4626(auraRewardPool).maxRedeem(address(this));

        IRewardStaking(auraRewardPool).withdrawAndUnwrap(
            bptBalance,
            true // also claim reward tokens
        );
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
        /* Similar to Convex, calling this function collects both of the
         * accrued BAL and AURA tokens.
         */
        IRewardStaking(auraRewardPool).getReward();
        _collectRewardTokens();
    }

    /***************************************
                    Approvals
    ****************************************/

    function _approveBase() internal override {
        // Approve Balancer vault for WETH and OETH (required for adding liquidity)
        // slither-disable-next-line unused-return
        oToken.approve(address(balancerVault), type(uint256).max);
        // slither-disable-next-line unused-return
        asset.approve(address(balancerVault), type(uint256).max);

        // Approve Aura rewards pool to transfer Balancer pool tokens (BPT)
        // slither-disable-next-line unused-return
        lpToken.approve(auraRewardPool, type(uint256).max);
    }
}
