// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Curve Automated Market Maker (AMO) Strategy
 * @notice AMO strategy for the Curve OETH/WETH pool
 * @author Origin Protocol Inc
 */
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { ICurveStableSwapNG } from "../interfaces/ICurveStableSwapNG.sol";
import { ICurveXChainLiquidityGauge } from "../interfaces/ICurveXChainLiquidityGauge.sol";
import { IChildLiquidityGaugeFactory } from "../interfaces/IChildLiquidityGaugeFactory.sol";

contract BaseCurveAMOStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeCast for uint256;

    /**
     * @dev a threshold under which the contract no longer allows for the protocol to manually rebalance.
     *      Guarding against a strategist / guardian being taken over and with multiple transactions
     *      draining the protocol funds.
     */
    uint256 public constant SOLVENCY_THRESHOLD = 0.998 ether;

    // New immutable variables that must be set in the constructor
    /**
     * @notice Address of the Wrapped ETH (WETH) contract.
     */
    IWETH9 public immutable weth;

    /**
     * @notice Address of the OETH token contract.
     */
    IERC20 public immutable oeth;

    /**
     * @notice Address of the LP (Liquidity Provider) token contract.
     */
    IERC20 public immutable lpToken;

    /**
     * @notice Address of the Curve StableSwap NG pool contract.
     */
    ICurveStableSwapNG public immutable curvePool;

    /**
     * @notice Address of the Curve X-Chain Liquidity Gauge contract.
     */
    ICurveXChainLiquidityGauge public immutable gauge;

    /**
     * @notice Address of the Child Liquidity Gauge Factory contract.
     */
    IChildLiquidityGaugeFactory public immutable gaugeFactory;

    // Ordered list of pool assets
    uint128 public immutable oethCoinIndex;
    uint128 public immutable wethCoinIndex;

    /**
     * @notice Maximum slippage allowed for adding/removing liquidity from the Curve pool.
     */
    uint256 public maxSlippage;

    event MaxSlippageUpdated(uint256 newMaxSlippage);

    /**
     * @dev Verifies that the caller is the Strategist.
     */
    modifier onlyStrategist() {
        require(
            msg.sender == IVault(vaultAddress).strategistAddr(),
            "Caller is not the Strategist"
        );
        _;
    }

    /**
     * @dev Checks the Curve pool's balances have improved and the balances
     * have not tipped to the other side.
     * This modifier is only applied to functions that do a single sided add or remove.
     * The standard deposit function adds to both sides of the pool in a way that
     * the pool's balance is not worsened.
     * Withdrawals are proportional so doesn't change the pools asset balance.
     */
    modifier improvePoolBalance() {
        // Get the asset and OToken balances in the Curve pool
        uint256[] memory balancesBefore = curvePool.get_balances();
        // diff = ETH balance - OETH balance
        int256 diffBefore = balancesBefore[wethCoinIndex].toInt256() -
            balancesBefore[oethCoinIndex].toInt256();

        _;

        // Get the asset and OToken balances in the Curve pool
        uint256[] memory balancesAfter = curvePool.get_balances();
        // diff = ETH balance - OETH balance
        int256 diffAfter = balancesAfter[wethCoinIndex].toInt256() -
            balancesAfter[oethCoinIndex].toInt256();

        if (diffBefore == 0) {
            require(diffAfter == 0, "Position balance is worsened");
        } else if (diffBefore < 0) {
            // If the pool was originally imbalanced in favor of OETH, then
            // we want to check that the pool is now more balanced
            require(diffAfter <= 0, "OTokens overshot peg");
            require(diffBefore < diffAfter, "OTokens balance worse");
        } else if (diffBefore > 0) {
            // If the pool was originally imbalanced in favor of ETH, then
            // we want to check that the pool is now more balanced
            require(diffAfter >= 0, "Assets overshot peg");
            require(diffAfter < diffBefore, "Assets balance worse");
        }
    }

    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _oeth,
        address _weth,
        address _gauge,
        address _gaugeFactory,
        uint128 _oethCoinIndex,
        uint128 _wethCoinIndex
    ) InitializableAbstractStrategy(_baseConfig) {
        oethCoinIndex = _oethCoinIndex;
        wethCoinIndex = _wethCoinIndex;

        lpToken = IERC20(_baseConfig.platformAddress);
        curvePool = ICurveStableSwapNG(_baseConfig.platformAddress);

        oeth = IERC20(_oeth);
        weth = IWETH9(_weth);
        gauge = ICurveXChainLiquidityGauge(_gauge);
        gaugeFactory = IChildLiquidityGaugeFactory(_gaugeFactory);

        _setGovernor(address(0));
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of CRV
     * @param _maxSlippage Maximum slippage allowed for adding/removing liquidity from the Curve pool.
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // CRV
        uint256 _maxSlippage
    ) external onlyGovernor initializer {
        address[] memory pTokens = new address[](1);
        pTokens[0] = address(curvePool);

        address[] memory _assets = new address[](1);
        _assets[0] = address(weth);

        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            pTokens
        );

        _approveBase();
        _setMaxSlippage(_maxSlippage);
    }

    /***************************************
                    Deposit
    ****************************************/

    /**
     * @notice Deposit WETH into the Curve pool
     * @param _weth Address of Wrapped ETH (WETH) contract.
     * @param _amount Amount of WETH to deposit.
     */
    function deposit(address _weth, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_weth, _amount);
    }

    function _deposit(address _weth, uint256 _wethAmount) internal {
        require(_wethAmount > 0, "Must deposit something");
        require(_weth == address(weth), "Can only deposit WETH");

        emit Deposit(_weth, address(lpToken), _wethAmount);

        // Get the asset and OToken balances in the Curve pool
        uint256[] memory balances = curvePool.get_balances();
        // safe to cast since min value is at least 0
        uint256 oethToAdd = uint256(
            _max(
                0,
                balances[wethCoinIndex].toInt256() +
                    _wethAmount.toInt256() -
                    balances[oethCoinIndex].toInt256()
            )
        );

        /* Add so much OETH so that the pool ends up being balanced. And at minimum
         * add as much OETH as WETH and at maximum twice as much OETH.
         */
        oethToAdd = Math.max(oethToAdd, _wethAmount);
        oethToAdd = Math.min(oethToAdd, _wethAmount * 2);

        /* Mint OETH with a strategy that attempts to contribute to stability of OETH/WETH pool. Try
         * to mint so much OETH that after deployment of liquidity pool ends up being balanced.
         *
         * To manage unpredictability minimal OETH minted will always be at least equal or greater
         * to WETH amount deployed. And never larger than twice the WETH amount deployed even if
         * it would have a further beneficial effect on pool stability.
         */
        IVault(vaultAddress).mintForStrategy(oethToAdd);

        emit Deposit(address(oeth), address(lpToken), oethToAdd);

        uint256[] memory _amounts = new uint256[](2);
        _amounts[wethCoinIndex] = _wethAmount;
        _amounts[oethCoinIndex] = oethToAdd;

        uint256 valueInLpTokens = (_wethAmount + oethToAdd).divPrecisely(
            curvePool.get_virtual_price()
        );
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - maxSlippage
        );

        // Do the deposit to the Curve pool
        uint256 lpDeposited = curvePool.add_liquidity(_amounts, minMintAmount);
        require(lpDeposited >= minMintAmount, "Min LP amount error");

        // Deposit the Curve pool's LP tokens into the Curve gauge
        gauge.deposit(lpDeposited);

        // Ensure solvency of the vault
        _solvencyAssert();
    }

    /**
     * @notice Deposit the strategy's entire balance of WETH into the Curve pool
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 balance = weth.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(weth), balance);
        }
    }

    /***************************************
                    Withdraw
    ****************************************/

    /**
     * @notice Withdraw ETH and OETH from the Curve pool, burn the OETH,
     * convert the ETH to WETH and transfer to the recipient.
     * @param _recipient Address to receive withdrawn asset which is normally the Vault.
     * @param _weth Address of the Wrapped ETH (WETH) contract.
     * @param _amount Amount of WETH to withdraw.
     */
    function withdraw(
        address _recipient,
        address _weth,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_amount > 0, "Must withdraw something");
        require(_weth == address(weth), "Can only withdraw WETH");

        emit Withdrawal(_weth, address(lpToken), _amount);

        uint256 requiredLpTokens = calcTokenToBurn(_amount);

        _lpWithdraw(requiredLpTokens);

        /* math in requiredLpTokens should correctly calculate the amount of LP to remove
         * in that the strategy receives enough WETH on balanced removal
         */
        uint256[] memory _minWithdrawalAmounts = new uint256[](2);
        _minWithdrawalAmounts[wethCoinIndex] = _amount;
        // slither-disable-next-line unused-return
        curvePool.remove_liquidity(requiredLpTokens, _minWithdrawalAmounts);

        // Burn all the removed OETH and any that was left in the strategy
        uint256 oethToBurn = oeth.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oethToBurn);

        emit Withdrawal(address(oeth), address(lpToken), oethToBurn);

        // Transfer WETH to the recipient
        require(
            weth.transfer(_recipient, _amount),
            "Transfer of WETH not successful"
        );

        // Ensure solvency of the vault
        _solvencyAssert();
    }

    function calcTokenToBurn(uint256 _wethAmount)
        internal
        view
        returns (uint256 lpToBurn)
    {
        /* The rate between coins in the pool determines the rate at which pool returns
         * tokens when doing balanced removal (remove_liquidity call). And by knowing how much WETH
         * we want we can determine how much of OETH we receive by removing liquidity.
         *
         * Because we are doing balanced removal we should be making profit when removing liquidity in a
         * pool tilted to either side.
         *
         * Important: A downside is that the Strategist / Governor needs to be
         * cognisant of not removing too much liquidity. And while the proposal to remove liquidity
         * is being voted on the pool tilt might change so much that the proposal that has been valid while
         * created is no longer valid.
         */

        uint256 poolWETHBalance = curvePool.balances(wethCoinIndex);
        /* K is multiplied by 1e36 which is used for higher precision calculation of required
         * pool LP tokens. Without it the end value can have rounding errors up to precision of
         * 10 digits. This way we move the decimal point by 36 places when doing the calculation
         * and again by 36 places when we are done with it.
         */
        uint256 k = (1e36 * lpToken.totalSupply()) / poolWETHBalance;
        // prettier-ignore
        // slither-disable-next-line divide-before-multiply
        uint256 diff = (_wethAmount + 1) * k;
        lpToBurn = diff / 1e36;
    }

    /**
     * @notice Remove all ETH and OETH from the Curve pool, burn the OETH,
     * convert the ETH to WETH and transfer to the Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 gaugeTokens = gauge.balanceOf(address(this));
        // Can not withdraw zero LP tokens from the gauge
        if (gaugeTokens == 0) return;
        _lpWithdraw(gaugeTokens);

        // Withdraws are proportional to assets held by 3Pool
        uint256[] memory minWithdrawAmounts = new uint256[](2);

        // Remove liquidity
        // slither-disable-next-line unused-return
        curvePool.remove_liquidity(
            lpToken.balanceOf(address(this)),
            minWithdrawAmounts
        );

        // Burn all OETH
        uint256 oethToBurn = oeth.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oethToBurn);

        // Get the strategy contract's WETH balance.
        // This includes all that was removed from the Curve pool and
        // any ether that was sitting in the strategy contract before the removal.
        uint256 ethBalance = weth.balanceOf(address(this));
        require(
            weth.transfer(vaultAddress, ethBalance),
            "Transfer of WETH not successful"
        );

        emit Withdrawal(address(weth), address(lpToken), ethBalance);
        emit Withdrawal(address(oeth), address(lpToken), oethToBurn);
    }

    /***************************************
            Curve pool Rebalancing
    ****************************************/

    /**
     * @notice Mint OTokens and one-sided add to the Curve pool.
     * This is used when the Curve pool does not have enough OTokens and too many ETH.
     * The OToken/Asset, eg OETH/ETH, price with increase.
     * The amount of assets in the vault is unchanged.
     * The total supply of OTokens is increased.
     * The asset value of the strategy and vault is increased.
     * @param _oTokens The amount of OTokens to be minted and added to the pool.
     */
    function mintAndAddOTokens(uint256 _oTokens)
        external
        onlyStrategist
        nonReentrant
        improvePoolBalance
    {
        IVault(vaultAddress).mintForStrategy(_oTokens);

        uint256[] memory amounts = new uint256[](2);
        amounts[oethCoinIndex] = _oTokens;

        // Convert OETH to Curve pool LP tokens
        uint256 valueInLpTokens = (_oTokens).divPrecisely(
            curvePool.get_virtual_price()
        );
        // Apply slippage to LP tokens
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - maxSlippage
        );

        // Add the minted OTokens to the Curve pool
        uint256 lpDeposited = curvePool.add_liquidity(amounts, minMintAmount);
        require(lpDeposited >= minMintAmount, "Min LP amount error");

        // Deposit the Curve pool LP tokens to the Curve gauge
        gauge.deposit(lpDeposited);

        // Ensure solvency of the vault
        _solvencyAssert();

        emit Deposit(address(oeth), address(lpToken), _oTokens);
    }

    /**
     * @notice One-sided remove of OTokens from the Curve pool which are then burned.
     * This is used when the Curve pool has too many OTokens and not enough ETH.
     * The amount of assets in the vault is unchanged.
     * The total supply of OTokens is reduced.
     * The asset value of the strategy and vault is reduced.
     * @param _lpTokens The amount of Curve pool LP tokens to be burned for OTokens.
     */
    function removeAndBurnOTokens(uint256 _lpTokens)
        external
        onlyStrategist
        nonReentrant
        improvePoolBalance
    {
        // Withdraw Curve pool LP tokens from Convex and remove OTokens from the Curve pool
        uint256 oethToBurn = _withdrawAndRemoveFromPool(
            _lpTokens,
            oethCoinIndex
        );

        // The vault burns the OTokens from this strategy
        IVault(vaultAddress).burnForStrategy(oethToBurn);

        // Ensure solvency of the vault
        _solvencyAssert();

        emit Withdrawal(address(oeth), address(lpToken), oethToBurn);
    }

    /**
     * @notice One-sided remove of ETH from the Curve pool, convert to WETH
     * and transfer to the vault.
     * This is used when the Curve pool does not have enough OTokens and too many ETH.
     * The OToken/Asset, eg OETH/ETH, price with decrease.
     * The amount of assets in the vault increases.
     * The total supply of OTokens does not change.
     * The asset value of the strategy reduces.
     * The asset value of the vault should be close to the same.
     * @param _lpTokens The amount of Curve pool LP tokens to be burned for ETH.
     * @dev Curve pool LP tokens is used rather than WETH assets as Curve does not
     * have a way to accurately calculate the amount of LP tokens for a required
     * amount of ETH. Curve's `calc_token_amount` functioun does not include fees.
     * A 3rd party libary can be used that takes into account the fees, but this
     * is a gas intensive process. It's easier for the trusted strategist to
     * caclulate the amount of Curve pool LP tokens required off-chain.
     */
    function removeOnlyAssets(uint256 _lpTokens)
        external
        onlyStrategist
        nonReentrant
        improvePoolBalance
    {
        // Withdraw Curve pool LP tokens from Curve gauge and remove ETH from the Curve pool
        uint256 ethAmount = _withdrawAndRemoveFromPool(
            _lpTokens,
            wethCoinIndex
        );

        // Transfer WETH to the vault
        require(
            weth.transfer(vaultAddress, ethAmount),
            "Transfer of WETH not successful"
        );

        // Ensure solvency of the vault
        _solvencyAssert();

        emit Withdrawal(address(weth), address(lpToken), ethAmount);
    }

    /**
     * @dev Remove Curve pool LP tokens from the Convex pool and
     * do a one-sided remove of ETH or OETH from the Curve pool.
     * @param _lpTokens The amount of Curve pool LP tokens to be removed from the Convex pool.
     * @param coinIndex The index of the coin to be removed from the Curve pool. 0 = ETH, 1 = OETH.
     * @return coinsRemoved The amount of ETH or OETH removed from the Curve pool.
     */
    function _withdrawAndRemoveFromPool(uint256 _lpTokens, uint128 coinIndex)
        internal
        returns (uint256 coinsRemoved)
    {
        // Withdraw Curve pool LP tokens from Curve gauge
        _lpWithdraw(_lpTokens);

        // Convert Curve pool LP tokens to ETH value
        uint256 valueInEth = _lpTokens.mulTruncate(
            curvePool.get_virtual_price()
        );
        // Apply slippage to ETH value
        uint256 minAmount = valueInEth.mulTruncate(uint256(1e18) - maxSlippage);

        // Remove just the ETH from the Curve pool
        coinsRemoved = curvePool.remove_liquidity_one_coin(
            _lpTokens,
            int128(coinIndex),
            minAmount,
            address(this)
        );
    }

    /**
     * Checks that the protocol is solvent, protecting from a rogue Strategist / Guardian that can
     * keep rebalancing the pool in both directions making the protocol lose a tiny amount of
     * funds each time.
     *
     * Protocol must be at least SOLVENCY_THRESHOLD (99,8 %) backed in order for the rebalances to
     * function.
     */
    function _solvencyAssert() internal view {
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
     * @notice Collect accumulated CRV (and other) rewards and send to the Harvester.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
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

        _collectRewardTokens();
    }

    function _lpWithdraw(uint256 _lpAmount) internal {
        // withdraw lp tokens from the gauge without claiming rewards
        gauge.withdraw(_lpAmount);
    }

    /**
     * @notice Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
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

    /**
     * @notice Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == address(weth);
    }

    /***************************************
                    Approvals
    ****************************************/

    /**
     * @notice Sets the maximum slippage allowed for any swap/liquidity operation
     * @param _maxSlippage Maximum slippage allowed, 1e18 = 100%.
     */
    function setMaxSlippage(uint256 _maxSlippage) external onlyGovernor {
        _setMaxSlippage(_maxSlippage);
    }

    function _setMaxSlippage(uint256 _maxSlippage) internal {
        require(_maxSlippage <= 5e16, "Slippage must be less than 5%");
        maxSlippage = _maxSlippage;
        emit MaxSlippageUpdated(_maxSlippage);
    }

    /**
     * @notice Approve the spending of all assets by their corresponding pool tokens,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        _approveBase();
    }

    /**
     * @dev Since we are unwrapping WETH before depositing it to Curve
     *      there is no need to set an approval for WETH on the Curve
     *      pool
     * @param _asset Address of the asset
     * @param _pToken Address of the Curve LP token
     */
    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {}

    function _approveBase() internal {
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

    /**
     * @dev Returns the largest of two numbers int256 version
     */
    function _max(int256 a, int256 b) internal pure returns (int256) {
        return a >= b ? a : b;
    }
}
