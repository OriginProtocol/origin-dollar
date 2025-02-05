// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Curve Automated Market Maker (AMO) Strategy
 * @notice AMO strategy for the Curve OETH/WETH pool
 * @author Origin Protocol Inc
 */
import "@openzeppelin/contracts/utils/math/Math.sol";

import { StableMath } from "../utils/StableMath.sol";
import { IVault } from "../interfaces/IVault.sol";
import { ICurveStableSwapNG } from "../interfaces/ICurveStableSwapNG.sol";
import { ICurveXChainLiquidityGauge } from "../interfaces/ICurveXChainLiquidityGauge.sol";
import { IChildLiquidityGaugeFactory } from "../interfaces/IChildLiquidityGaugeFactory.sol";
import { AbstractCurveAMOStrategy } from "./AbstractCurveAMOStrategy.sol";

contract BaseCurveAMOStrategy is AbstractCurveAMOStrategy {
    using StableMath for uint256;

    /**
     * @dev a threshold under which the contract no longer allows for the protocol to manually rebalance.
     *      Guarding against a strategist / guardian being taken over and with multiple transactions
     *      draining the protocol funds.
     */
    uint256 public constant SOLVENCY_THRESHOLD = 0.998 ether;

    uint256 public constant MAX_SLIPPAGE = 1e16; // 1%, same as the Curve UI

    // New immutable variables that must be set in the constructor
    /**
     * @notice Address of the Curve X-Chain Liquidity Gauge contract.
     */
    ICurveXChainLiquidityGauge public immutable gauge;

    /**
     * @notice Address of the Child Liquidity Gauge Factory contract.
     */
    IChildLiquidityGaugeFactory public immutable gaugeFactory;

    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _oeth,
        address _weth,
        address _gauge,
        address _gaugeFactory
    ) AbstractCurveAMOStrategy(_baseConfig, _oeth, _weth, false) {
        gauge = ICurveXChainLiquidityGauge(_gauge);
        gaugeFactory = IChildLiquidityGaugeFactory(_gaugeFactory);
    }

    /***************************************
                Internal functions
    ****************************************/

    function _addLiquidity(
        uint256[] memory _amounts,
        uint256 _minMintAmount
    ) internal override returns (uint256) {
        return
            ICurveStableSwapNG(address(curvePool)).add_liquidity(
                _amounts,
                _minMintAmount
            );
    }

    function _removeLiquidity(
        uint256 _requiredLpTokens,
        uint256[] memory _minAmounts
    ) internal override {
        ICurveStableSwapNG(address(curvePool)).remove_liquidity(
            _requiredLpTokens,
            _minAmounts
        );
    }

    function _removeLiquidityOneCoin(
        uint256 _lpTokens,
        uint128 _coinIndex,
        uint256 _minAmount
    ) internal override returns (uint256) {
        return
            ICurveStableSwapNG(address(curvePool)).remove_liquidity_one_coin(
                _lpTokens,
                int128(_coinIndex),
                _minAmount,
                address(this)
            );
    }

    function _stakeLP(uint256 _lpTokens) internal override {
        gauge.deposit(_lpTokens);
    }

    function _unstakeLP(uint256 _lpToken) internal override {
        if (_lpToken == type(uint256).max) {
            _lpToken = gauge.balanceOf(address(this));
        }

        // withdraw lp tokens from the gauge without claiming rewards
        gauge.withdraw(_lpToken);
    }

    function _claimReward() internal override {
        // CRV rewards flow.
        //---
        // CRV inflation:
        // Gauge receive CRV rewards from inflation.
        // Each checkpoint on the gauge send this CRV inflation to gauge factory.
        // This strategy should call mint on the gauge factory to collect the CRV rewards.
        // ---
        // Extra rewards:
        // Calling claim_rewards on the gauge will only claim extra rewards (outside of CRV).
        // ---

        // Mint CRV on Child Liquidity gauge factory
        gaugeFactory.mint(address(gauge));
        // Collect extra gauge rewards (outside of CRV)
        gauge.claim_rewards();
    }

    function _approveBase() internal override {
        // Approve Curve pool for OETH (required for adding liquidity)
        // slither-disable-next-line unused-return
        oeth.approve(platformAddress, type(uint256).max);

        // Approve Curve pool for WETH (required for adding liquidity)
        // slither-disable-next-line unused-return
        weth.approve(platformAddress, type(uint256).max);

        // Approve Curve gauge contract to transfer Curve pool LP tokens
        // This is needed for deposits if Curve pool LP tokens into the Curve gauge.
        // slither-disable-next-line unused-return
        lpToken.approve(address(gauge), type(uint256).max);
    }

    function _getBalances() internal view override returns (uint256[] memory) {
        return ICurveStableSwapNG(address(curvePool)).get_balances();
    }

    function maxSlippage() internal pure override returns (uint256) {
        return MAX_SLIPPAGE;
    }

    /**
     * Checks that the protocol is solvent, protecting from a rogue Strategist / Guardian that can
     * keep rebalancing the pool in both directions making the protocol lose a tiny amount of
     * funds each time.
     *
     * Protocol must be at least SOLVENCY_THRESHOLD (99,8 %) backed in order for the rebalances to
     * function.
     */
    function _solvencyAssert() internal view override {
        uint256 _totalVaultValue = IVault(vaultAddress).totalValue();
        uint256 _totalOethbSupply = oeth.totalSupply();

        if (
            _totalVaultValue.divPrecisely(_totalOethbSupply) <
            SOLVENCY_THRESHOLD
        ) {
            revert("Protocol insolvent");
        }
    }

    /***************************************
                Assets and Rewards
    ****************************************/

    /**
     * @notice Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        public
        view
        override
        returns (uint256 balance)
    {
        require(_asset == address(weth), "Unsupported asset");

        // WETH balance needed here for the balance check that happens from vault during depositing.
        balance = weth.balanceOf(address(this));
        uint256 lpTokens = gauge.balanceOf(address(this));
        if (lpTokens > 0) {
            balance += (lpTokens * curvePool.get_virtual_price()) / 1e18;
        }
    }
}
