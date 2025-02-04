// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Convex Automated Market Maker (AMO) Strategy
 * @notice AMO strategy for the Curve OETH/ETH pool
 * @author Origin Protocol Inc
 */
import "@openzeppelin/contracts/utils/math/Math.sol";

import { ICurveETHPoolV1 } from "./ICurveETHPoolV1.sol";
import { StableMath } from "../utils/StableMath.sol";
import { IConvexDeposits } from "./IConvexDeposits.sol";
import { IRewardStaking } from "./IRewardStaking.sol";
import { AbstractCurveAMOStrategy } from "./AbstractCurveAMOStrategy.sol";

contract ConvexEthMetaStrategy is AbstractCurveAMOStrategy {
    using StableMath for uint256;

    uint256 public constant MAX_SLIPPAGE = 1e16; // 1%, same as the Curve UI
    address public constant ETH_ADDRESS =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // The following slots have been deprecated with immutable variables
    // slither-disable-next-line constable-states
    address private _deprecated_cvxDepositorAddress;
    // slither-disable-next-line constable-states
    address private _deprecated_cvxRewardStaker;
    // slither-disable-next-line constable-states
    uint256 private _deprecated_cvxDepositorPTokenId;
    // slither-disable-next-line constable-states
    address private _deprecated_curvePool;
    // slither-disable-next-line constable-states
    address private _deprecated_lpToken;
    // slither-disable-next-line constable-states
    address private _deprecated_oeth;
    // slither-disable-next-line constable-states
    address private _deprecated_weth;

    // Ordered list of pool assets
    // slither-disable-next-line constable-states
    uint128 private _deprecated_oethCoinIndex;
    // slither-disable-next-line constable-states
    uint128 private _deprecated_ethCoinIndex;

    // New immutable variables that must be set in the constructor
    address public immutable cvxDepositorAddress;
    IRewardStaking public immutable cvxRewardStaker;
    uint256 public immutable cvxDepositorPTokenId;

    // Used to circumvent the stack too deep issue
    struct ConvexEthMetaConfig {
        address cvxDepositorAddress; //Address of the Convex depositor(AKA booster) for this pool
        address cvxRewardStakerAddress; //Address of the CVX rewards staker
        uint256 cvxDepositorPTokenId; //Pid of the pool referred to by Depositor and staker
        address oethAddress; //Address of OETH token
        address wethAddress; //Address of WETH
    }

    constructor(
        BaseStrategyConfig memory _baseConfig,
        ConvexEthMetaConfig memory _convexConfig
    )
        AbstractCurveAMOStrategy(
            _baseConfig,
            _convexConfig.oethAddress,
            _convexConfig.wethAddress
        )
    {
        cvxDepositorAddress = _convexConfig.cvxDepositorAddress;
        cvxRewardStaker = IRewardStaking(_convexConfig.cvxRewardStakerAddress);
        cvxDepositorPTokenId = _convexConfig.cvxDepositorPTokenId;
    }

    /***************************************
                Internal functions
    ****************************************/

    function _addLiquidity(
        uint256[] memory _amounts,
        uint256 _ethValue,
        uint256 _minMintAmount
    ) internal override returns (uint256) {
        uint256[2] memory amounts = [
            _amounts[ethCoinIndex],
            _amounts[oethCoinIndex]
        ];

        return
            _ethValue != 0
                ? ICurveETHPoolV1(address(curvePool)).add_liquidity{
                    value: _amounts[ethCoinIndex]
                }(amounts, _minMintAmount)
                : ICurveETHPoolV1(address(curvePool)).add_liquidity(
                    amounts,
                    _minMintAmount
                );
    }

    function _removeLiquidity(
        uint256 _requiredLpTokens,
        uint256[] memory _minAmounts
    ) internal override {
        uint256[2] memory minAmounts = [
            _minAmounts[ethCoinIndex],
            _minAmounts[oethCoinIndex]
        ];

        if (_requiredLpTokens == type(uint256).max) {
            _requiredLpTokens = lpToken.balanceOf(address(this));
        }

        ICurveETHPoolV1(address(curvePool)).remove_liquidity(
            _requiredLpTokens,
            minAmounts
        );
    }

    function _removeLiquidityOneCoin(
        uint256 _lpTokens,
        uint128 _coinIndex,
        uint256 _minAmount
    ) internal override returns (uint256) {
        return
            ICurveETHPoolV1(address(curvePool)).remove_liquidity_one_coin(
                _lpTokens,
                int128(_coinIndex),
                _minAmount,
                address(this)
            );
    }

    function _stakeLP(uint256 _lpTokens) internal override {
        // Deposit the Curve pool LP tokens to the Convex rewards pool
        require(
            IConvexDeposits(cvxDepositorAddress).deposit(
                cvxDepositorPTokenId,
                _lpTokens,
                true // Deposit with staking
            ),
            "Failed to Deposit LP to Convex"
        );
    }

    function _unstakeLP(uint256 _lpToken) internal override {
        if (_lpToken == type(uint256).max) {
            _lpToken = cvxRewardStaker.balanceOf(address(this));
        }
        // withdraw and unwrap with claim takes back the lpTokens
        // and also collects the rewards for deposit
        cvxRewardStaker.withdrawAndUnwrap(_lpToken, true);
    }

    function _wrapETH(uint256 _wethAmount) internal override {
        if (_wethAmount == type(uint256).max) {
            _wethAmount = address(this).balance;
        }
        weth.deposit{ value: _wethAmount }();
    }

    function _unwrapETH(uint256 _amount) internal override {
        weth.withdraw(_amount);
    }

    function _claimReward() internal override {
        // Collect CRV and CVX
        cvxRewardStaker.getReward();
    }

    function _approveBase() internal override {
        // Approve Curve pool for OETH (required for adding liquidity)
        // No approval is needed for ETH
        // slither-disable-next-line unused-return
        oeth.approve(platformAddress, type(uint256).max);

        // Approve Convex deposit contract to transfer Curve pool LP tokens
        // This is needed for deposits if Curve pool LP tokens into the Convex rewards pool
        // slither-disable-next-line unused-return
        lpToken.approve(cvxDepositorAddress, type(uint256).max);
    }

    function _getBalances() internal view override returns (uint256[] memory) {
        uint256[2] memory _balances = ICurveETHPoolV1(address(curvePool))
            .get_balances();

        uint256[] memory balances = new uint256[](2);
        balances[ethCoinIndex] = _balances[uint256(ethCoinIndex)];
        balances[oethCoinIndex] = _balances[uint256(oethCoinIndex)];

        return balances;
    }

    function _solvencyAssert() internal view override {
        // Do nothing
    }

    function maxSlippage() internal pure override returns (uint256) {
        return MAX_SLIPPAGE;
    }

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

        // Eth balance needed here for the balance check that happens from vault during depositing.
        balance = address(this).balance;
        uint256 lpTokens = cvxRewardStaker.balanceOf(address(this));
        if (lpTokens > 0) {
            balance += (lpTokens * curvePool.get_virtual_price()) / 1e18;
        }
    }
}
