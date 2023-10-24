// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Curve 3Pool Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICurveGauge } from "./curve/ICurveGauge.sol";
import { ICurvePool } from "./curve/ICurvePool.sol";
import { ICRVMinter } from "./curve/ICRVMinter.sol";
import { CurveThreeCoin } from "./curve/CurveThreeCoin.sol";
import { IERC20, BaseCurveStrategy, InitializableAbstractStrategy } from "./BaseCurveStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";

/*
 * IMPORTANT(!) If ThreePoolStrategy needs to be re-deployed, it requires new
 * proxy contract with fresh storage slots. Changes in `BaseCurveStrategy`
 * storage slots would break existing implementation.
 *
 * Remove this notice if ThreePoolStrategy is re-deployed
 */
contract ThreePoolStrategy is BaseCurveStrategy, CurveThreeCoin {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    address internal crvGaugeAddress;
    address internal crvMinterAddress;

    constructor(
        BaseStrategyConfig memory _stratConfig,
        CurveConfig memory _config
    ) InitializableAbstractStrategy(_stratConfig) BaseCurveStrategy(_config) {}

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddress Address of CRV
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                DAI, USDC, USDT
     * @param _pTokens Platform Token corresponding addresses
     * @param _crvGaugeAddress Address of the Curve DAO gauge for this pool
     * @param _crvMinterAddress Address of the CRV minter for rewards
     */
    function initialize(
        address[] calldata _rewardTokenAddress, // CRV
        address[] calldata _assets,
        address[] calldata _pTokens,
        address _crvGaugeAddress,
        address _crvMinterAddress
    ) external onlyGovernor initializer {
        require(_assets.length == 3, "Must have exactly three assets");
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        crvGaugeAddress = _crvGaugeAddress;
        crvMinterAddress = _crvMinterAddress;
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddress,
            _assets,
            _pTokens
        );
        _approveBase();
    }

    function _lpDepositAll() internal override {
        IERC20 pToken = IERC20(CURVE_LP_TOKEN);
        // Deposit into Gauge
        ICurveGauge(crvGaugeAddress).deposit(
            pToken.balanceOf(address(this)),
            address(this)
        );
    }

    function _lpWithdraw(uint256 numPTokens) internal override {
        // Not enough of pool token exists on this contract, some must be
        // staked in Gauge, unstake difference
        ICurveGauge(crvGaugeAddress).withdraw(numPTokens);
    }

    function _lpWithdrawAll() internal override {
        ICurveGauge gauge = ICurveGauge(crvGaugeAddress);
        gauge.withdraw(gauge.balanceOf(address(this)));
    }

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(
        address _asset
    ) public view override returns (uint256 balance) {
        require(assetToPToken[_asset] != address(0), "Unsupported asset");
        // LP tokens in this contract. This should generally be nothing as we
        // should always stake the full balance in the Gauge, but include for
        // safety

        uint256 contractPTokens = IERC20(CURVE_LP_TOKEN).balanceOf(
            address(this)
        );
        ICurveGauge gauge = ICurveGauge(crvGaugeAddress);
        uint256 gaugePTokens = gauge.balanceOf(address(this));
        uint256 totalPTokens = contractPTokens + gaugePTokens;

        ICurvePool curvePool = ICurvePool(platformAddress);
        if (totalPTokens > 0) {
            uint256 virtual_price = curvePool.get_virtual_price();
            uint256 value = (totalPTokens * virtual_price) / 1e18;
            uint256 assetDecimals = Helpers.getDecimals(_asset);
            balance = value.scaleBy(assetDecimals, 18) / 3;
        }
    }

    function _approveBase() internal override {
        IERC20 pToken = IERC20(CURVE_LP_TOKEN);
        // 3Pool for LP token (required for removing liquidity)
        pToken.safeApprove(CURVE_POOL, 0);
        pToken.safeApprove(CURVE_POOL, type(uint256).max);
        // Gauge for LP token
        pToken.safeApprove(crvGaugeAddress, 0);
        pToken.safeApprove(crvGaugeAddress, type(uint256).max);
    }

    /**
     * @dev Collect accumulated CRV and send to Vault.
     */
    function collectRewardTokens() public override onlyHarvester nonReentrant {
        // Collect
        ICRVMinter(crvMinterAddress).mint(crvGaugeAddress);
        // Send
        IERC20 crvToken = IERC20(rewardTokenAddresses[0]);
        uint256 balance = crvToken.balanceOf(address(this));
        emit RewardTokenCollected(
            harvesterAddress,
            rewardTokenAddresses[0],
            balance
        );
        crvToken.safeTransfer(harvesterAddress, balance);
    }

    /**
     * @notice Deposit coins into a Curve pool
     * @param _pool Address of the Curve pool
     * @param _amounts List of amounts of coins to deposit
     * @param _min_mint_amount Minimum amount of LP tokens to mint from the deposit
     */
    function _curve_add_liquidity(
        address _pool,
        uint256[] memory _amounts,
        uint256 _min_mint_amount
    ) internal override(BaseCurveStrategy, CurveThreeCoin) {
        _curve_add_liquidity(_pool, _amounts, _min_mint_amount);
    }

    /**
     * @notice Calculate amount of LP required when withdrawing specific amount of one
     * of the underlying assets accounting for fees and slippage.
     * @param _pool Address of the Curve pool
     * @param _coinIndex index of the coin in the Curve pool that is to be withdrawn
     * @param _assetAmount Amount of of the indexed coin to withdraw
     * @return lpAmount Curve LP tokens required to remove the coin amounts
     */
    function _curveCalcWithdrawLpAmount(
        address _pool,
        uint256 _coinIndex,
        uint256 _assetAmount
    )
        internal
        view
        override(BaseCurveStrategy, CurveThreeCoin)
        returns (uint256 lpAmount)
    {
        lpAmount = _curveCalcWithdrawLpAmount(_pool, _coinIndex, _assetAmount);
    }

    /**
     * @notice Withdraws a single asset from the pool
     * @param _pool Address of the Curve pool
     * @param _amount The amount of underlying coin to withdraw
     * @param _coin_index Curve pool index of the coin to withdraw
     * @param _max_burn_amount Maximum amount of LP token to burn in the withdrawal
     * @param _asset The token address of the coin being withdrawn
     * @param _receiver Address that receives the withdrawn coins
     */
    function _curve_remove_liquidity_imbalance(
        address _pool,
        uint256 _amount,
        uint256 _coin_index,
        uint256 _max_burn_amount,
        address _asset,
        address _receiver
    ) internal override(BaseCurveStrategy, CurveThreeCoin) {
        _curve_remove_liquidity_imbalance(
            _pool,
            _amount,
            _coin_index,
            _max_burn_amount,
            _asset,
            _receiver
        );
    }

    /**
     * @notice Withdraw coins from the pool
     * @dev Withdrawal amounts are based on current deposit ratios
     * @param _pool Address of the Curve pool
     * @param _burn_amount Quantity of LP tokens to burn in the withdrawal
     * @param _min_amounts Minimum amounts of underlying coins to receive
     */
    function _curve_remove_liquidity(
        address _pool,
        uint256 _burn_amount,
        uint256[] memory _min_amounts
    ) internal override(BaseCurveStrategy, CurveThreeCoin) {
        _curve_remove_liquidity(_pool, _burn_amount, _min_amounts);
    }
}
