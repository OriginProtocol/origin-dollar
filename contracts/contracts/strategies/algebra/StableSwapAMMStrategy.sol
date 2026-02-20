// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Algebra Algorithmic Market Maker (AMO) Strategy
 * @notice AMO strategy for the Algebra stable swap pool
 * @author Origin Protocol Inc
 */
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../../utils/StableMath.sol";
import { sqrt } from "../../utils/PRBMath.sol";
import { IBasicToken } from "../../interfaces/IBasicToken.sol";
import { IPair } from "../../interfaces/algebra/IAlgebraPair.sol";
import { IGauge } from "../../interfaces/algebra/IAlgebraGauge.sol";
import { IVault } from "../../interfaces/IVault.sol";

contract StableSwapAMMStrategy is InitializableAbstractStrategy {
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    using SafeCast for uint256;

    /**
     * @notice a threshold under which the contract no longer allows for the protocol to manually rebalance.
     *      Guarding against a strategist / guardian being taken over and with multiple transactions
     *      draining the protocol funds.
     */
    uint256 public constant SOLVENCY_THRESHOLD = 0.998 ether;

    /// @notice Precision for the Algebra Stable AMM (sAMM) invariant k.
    uint256 public constant PRECISION = 1e18;

    /// @notice Address of the asset (non OToken) token contract
    address public immutable asset;

    /// @notice Address of the OToken token contract.
    address public immutable oToken;

    /// @notice Address of the Algebra Stable pool contract.
    address public immutable pool;

    /// @notice Address of the Algebra Gauge contract.
    address public immutable gauge;

    /// @notice Index of the OToken in the Algebra pool.
    uint256 public immutable oTokenPoolIndex;

    /// @notice The max amount the OToken/asset price can deviate from peg (1e18)
    /// before deposits are reverted scaled to 18 decimals.
    /// eg 0.01e18 or 1e16 is 1% which is 100 basis points.
    /// This is the amount below and above peg so a 50 basis point deviation (0.005e18)
    /// allows a price range from 0.995 to 1.005.
    uint256 public maxDepeg;

    event SwapOTokensToPool(
        uint256 oTokenMinted,
        uint256 assetDepositAmount,
        uint256 oTokenDepositAmount,
        uint256 lpTokens
    );
    event SwapAssetsToPool(
        uint256 assetSwapped,
        uint256 lpTokens,
        uint256 oTokenBurnt
    );
    event MaxDepegUpdated(uint256 maxDepeg);

    /**
     * @dev Verifies that the caller is the Strategist of the Vault.
     */
    modifier onlyStrategist() {
        require(
            msg.sender == IVault(vaultAddress).strategistAddr(),
            "Caller is not the Strategist"
        );
        _;
    }

    /**
     * @dev Skim the Algebra pool in case any extra asset or OToken tokens were added
     */
    modifier skimPool() {
        IPair(pool).skim(address(this));
        _;
    }

    /**
     * @dev Checks the pool is balanced enough to allow deposits.
     */
    modifier nearBalancedPool() {
        // OToken/asset price = asset / OToken
        // Get the OToken/asset price for selling 1 OToken for asset
        // As OToken is 1, the asset amount is the OToken/asset price
        uint256 sellPrice = IPair(pool).getAmountOut(1e18, oToken);

        // Get the amount of OToken received from selling 1 asset. This is buying OToken.
        uint256 oTokenAmount = IPair(pool).getAmountOut(1e18, asset);
        // Convert to a OToken/asset price = asset / OToken
        uint256 buyPrice = 1e36 / oTokenAmount;

        uint256 pegPrice = 1e18;

        require(
            sellPrice >= pegPrice - maxDepeg && buyPrice <= pegPrice + maxDepeg,
            "price out of range"
        );
        _;
    }

    /**
     * @dev Checks the pool's balances have improved and the balances
     * have not tipped to the other side.
     * This modifier is only applied to functions that do swaps against the pool.
     * Deposits and withdrawals are proportional to the pool's balances hence don't need this check.
     */
    modifier improvePoolBalance() {
        // Get the asset and OToken balances in the pool
        (
            uint256 assetReserveBefore,
            uint256 oTokenReserveBefore
        ) = _getPoolReserves();
        // diff = asset balance - OToken balance
        int256 diffBefore = assetReserveBefore.toInt256() -
            oTokenReserveBefore.toInt256();

        _;

        // Get the asset and OToken balances in the pool
        (
            uint256 assetReserveAfter,
            uint256 oTokenReserveAfter
        ) = _getPoolReserves();
        // diff = asset balance - OToken balance
        int256 diffAfter = assetReserveAfter.toInt256() -
            oTokenReserveAfter.toInt256();

        if (diffBefore == 0) {
            require(diffAfter == 0, "Position balance is worsened");
        } else if (diffBefore < 0) {
            // If the pool was originally imbalanced in favor of OToken, then
            // we want to check that the pool is now more balanced
            require(diffAfter <= 0, "Assets overshot peg");
            require(diffBefore < diffAfter, "OTokens balance worse");
        } else if (diffBefore > 0) {
            // If the pool was originally imbalanced in favor of asset, then
            // we want to check that the pool is now more balanced
            require(diffAfter >= 0, "OTokens overshot peg");
            require(diffAfter < diffBefore, "Assets balance worse");
        }
    }

    /**
     * @param _baseConfig The `platformAddress` is the address of the Algebra pool.
     * The `vaultAddress` is the address of the Origin Sonic Vault.
     * @param _oToken Address of the OToken.
     * @param _asset Address of the asset token.
     * @param _gauge Address of the Algebra gauge for the pool.
     */
    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _oToken,
        address _asset,
        address _gauge
    ) InitializableAbstractStrategy(_baseConfig) {
        // Checked both tokens are to 18 decimals
        require(
            IBasicToken(_asset).decimals() == 18 &&
                IBasicToken(_oToken).decimals() == 18,
            "Incorrect token decimals"
        );
        // Check the Algebra pool is a Stable AMM (sAMM)
        require(
            IPair(_baseConfig.platformAddress).isStable() == true,
            "Pool not stable"
        );
        // Check the gauge is for the pool
        require(
            IGauge(_gauge).TOKEN() == _baseConfig.platformAddress,
            "Incorrect gauge"
        );
        oTokenPoolIndex = IPair(_baseConfig.platformAddress).token0() == _oToken
            ? 0
            : 1;
        // Check the pool tokens are correct
        require(
            IPair(_baseConfig.platformAddress).token0() ==
                (oTokenPoolIndex == 0 ? _oToken : _asset) &&
                IPair(_baseConfig.platformAddress).token1() ==
                (oTokenPoolIndex == 0 ? _asset : _oToken),
            "Incorrect pool tokens"
        );

        // Set the immutable variables
        oToken = _oToken;
        asset = _asset;
        pool = _baseConfig.platformAddress;
        gauge = _gauge;

        // This is an implementation contract. The governor is set in the proxy contract.
        _setGovernor(address(0));
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Algebra strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Array containing SWPx token address
     * @param _maxDepeg The max amount the OToken/asset price can deviate from peg (1e18) before deposits are reverted.
     */
    function initialize(
        address[] calldata _rewardTokenAddresses,
        uint256 _maxDepeg
    ) external onlyGovernor initializer {
        address[] memory pTokens = new address[](1);
        pTokens[0] = pool;

        address[] memory _assets = new address[](1);
        _assets[0] = asset;

        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            pTokens
        );

        maxDepeg = _maxDepeg;

        _approveBase();
    }

    /***************************************
                    Deposit
    ****************************************/

    /**
     * @notice Deposit an amount of asset into the Algebra pool.
     * Mint OToken in proportion to the pool's asset and OToken reserves,
     * transfer asset and OToken to the pool,
     * mint the pool's LP token and deposit in the gauge.
     * @dev This tx must be wrapped by the VaultValueChecker.
     * To minimize loses, the pool should be rebalanced before depositing.
     * The pool's oToken/asset price must be within the maxDepeg range.
     * @param _asset Address of asset token.
     * @param _assetAmount Amount of asset tokens to deposit.
     */
    function deposit(address _asset, uint256 _assetAmount)
        external
        override
        onlyVault
        nonReentrant
        skimPool
        nearBalancedPool
    {
        require(_asset == asset, "Unsupported asset");
        require(_assetAmount > 0, "Must deposit something");

        (uint256 oTokenDepositAmount, ) = _deposit(_assetAmount);

        // Ensure solvency of the vault
        _solvencyAssert();

        // Emit event for the deposited asset tokens
        emit Deposit(asset, pool, _assetAmount);
        // Emit event for the minted OToken tokens
        emit Deposit(oToken, pool, oTokenDepositAmount);
    }

    /**
     * @notice Deposit all the strategy's asset tokens into the Algebra pool.
     * Mint OToken in proportion to the pool's asset and OToken reserves,
     * transfer asset and OToken to the pool,
     * mint the pool's LP token and deposit in the gauge.
     * @dev This tx must be wrapped by the VaultValueChecker.
     * To minimize loses, the pool should be rebalanced before depositing.
     * The pool's oToken/asset price must be within the maxDepeg range.
     */
    function depositAll()
        external
        override
        onlyVault
        nonReentrant
        skimPool
        nearBalancedPool
    {
        uint256 assetBalance = IERC20(asset).balanceOf(address(this));
        if (assetBalance > 0) {
            (uint256 oTokenDepositAmount, ) = _deposit(assetBalance);

            // Ensure solvency of the vault
            _solvencyAssert();

            // Emit event for the deposited asset tokens
            emit Deposit(asset, pool, assetBalance);
            // Emit event for the minted OToken tokens
            emit Deposit(oToken, pool, oTokenDepositAmount);
        }
    }

    /**
     * @dev Mint OToken in proportion to the pool's asset and OToken reserves,
     * transfer asset and OToken to the pool,
     * mint the pool's LP token and deposit in the gauge.
     * @param _assetAmount Amount of asset tokens to deposit.
     * @return oTokenDepositAmount Amount of OToken tokens minted and deposited into the pool.
     * @return lpTokens Amount of Algebra pool LP tokens minted and deposited into the gauge.
     */
    function _deposit(uint256 _assetAmount)
        internal
        returns (uint256 oTokenDepositAmount, uint256 lpTokens)
    {
        // Calculate the required amount of OToken to mint based on the asset amount.
        oTokenDepositAmount = _calcTokensToMint(_assetAmount);

        // Mint the required OToken tokens to this strategy
        IVault(vaultAddress).mintForStrategy(oTokenDepositAmount);

        // Add asset and OToken liquidity to the pool and stake in gauge
        lpTokens = _depositToPoolAndGauge(_assetAmount, oTokenDepositAmount);
    }

    /***************************************
                    Withdraw
    ****************************************/

    /**
     * @notice Withdraw asset and OToken from the Algebra pool, burn the OToken,
     * and transfer the asset to the recipient.
     * @param _recipient Address of the Vault.
     * @param _asset Address of the asset token.
     * @param _assetAmount Amount of asset tokens to withdraw.
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _assetAmount
    ) external override onlyVault nonReentrant skimPool {
        require(_assetAmount > 0, "Must withdraw something");
        require(_asset == asset, "Unsupported asset");
        // This strategy can't be set as a default strategy for asset in the Vault.
        // This means the recipient must always be the Vault.
        require(_recipient == vaultAddress, "Only withdraw to vault allowed");

        // Calculate how much pool LP tokens to burn to get the required amount of asset tokens back
        uint256 lpTokens = _calcTokensToBurn(_assetAmount);

        // Withdraw pool LP tokens from the gauge and remove assets from from the pool
        _withdrawFromGaugeAndPool(lpTokens);

        // Burn all the removed OToken and any that was left in the strategy
        uint256 oTokenToBurn = IERC20(oToken).balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oTokenToBurn);

        // Transfer asset to the recipient
        // Note there can be a dust amount of asset left in the strategy as
        // the burn of the pool's LP tokens is rounded up
        require(
            IERC20(asset).balanceOf(address(this)) >= _assetAmount,
            "Not enough asset removed"
        );
        IERC20(asset).safeTransfer(_recipient, _assetAmount);

        // Ensure solvency of the vault
        _solvencyAssert();

        // Emit event for the withdrawn asset tokens
        emit Withdrawal(asset, pool, _assetAmount);
        // Emit event for the burnt OToken tokens
        emit Withdrawal(oToken, pool, oTokenToBurn);
    }

    /**
     * @notice Withdraw all pool LP tokens from the gauge,
     * remove all asset and OToken from the Algebra pool,
     * burn all the OToken,
     * and transfer all the asset to the Vault contract.
     * @dev There is no solvency check here as withdrawAll can be called to
     * quickly secure assets to the Vault in emergencies.
     */
    function withdrawAll()
        external
        override
        onlyVaultOrGovernor
        nonReentrant
        skimPool
    {
        // Get all the pool LP tokens the strategy has staked in the gauge
        uint256 lpTokens = IGauge(gauge).balanceOf(address(this));
        // Can not withdraw zero LP tokens from the gauge
        if (lpTokens == 0) return;

        if (IGauge(gauge).emergency()) {
            // The gauge is in emergency mode
            _emergencyWithdrawFromGaugeAndPool();
        } else {
            // Withdraw pool LP tokens from the gauge and remove assets from from the pool
            _withdrawFromGaugeAndPool(lpTokens);
        }

        // Burn all OToken in this strategy contract
        uint256 oTokenToBurn = IERC20(oToken).balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oTokenToBurn);

        // Get the strategy contract's asset balance.
        // This includes all that was removed from the Algebra pool and
        // any that was sitting in the strategy contract before the removal.
        uint256 assetBalance = IERC20(asset).balanceOf(address(this));
        IERC20(asset).safeTransfer(vaultAddress, assetBalance);

        // Emit event for the withdrawn asset tokens
        emit Withdrawal(asset, pool, assetBalance);
        // Emit event for the burnt OToken tokens
        emit Withdrawal(oToken, pool, oTokenToBurn);
    }

    /***************************************
                Pool Rebalancing
    ****************************************/

    /** @notice Used when there is more OToken than asset in the pool.
     * asset and OToken is removed from the pool, the received asset is swapped for OToken
     * and the left over OToken in the strategy is burnt.
     * The OToken/asset price is < 1.0 so OToken is being bought at a discount.
     * @param _assetAmount Amount of asset tokens to swap into the pool.
     */
    function swapAssetsToPool(uint256 _assetAmount)
        external
        onlyStrategist
        nonReentrant
        improvePoolBalance
        skimPool
    {
        require(_assetAmount > 0, "Must swap something");

        // 1. Partially remove liquidity so there’s enough asset for the swap

        // Calculate how much pool LP tokens to burn to get the required amount of asset tokens back
        uint256 lpTokens = _calcTokensToBurn(_assetAmount);
        require(lpTokens > 0, "No LP tokens to burn");

        _withdrawFromGaugeAndPool(lpTokens);

        // 2. Swap asset for OToken against the pool
        // Swap exact amount of asset for OToken against the pool
        // There can be a dust amount of asset left in the strategy as the burn of the pool's LP tokens is rounded up
        _swapExactTokensForTokens(_assetAmount, asset, oToken);

        // 3. Burn all the OToken left in the strategy from the remove liquidity and swap
        uint256 oTokenToBurn = IERC20(oToken).balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oTokenToBurn);

        // Ensure solvency of the vault
        _solvencyAssert();

        // Emit event for the burnt OToken tokens
        emit Withdrawal(oToken, pool, oTokenToBurn);
        // Emit event for the swap
        emit SwapAssetsToPool(_assetAmount, lpTokens, oTokenToBurn);
    }

    /**
     * @notice Used when there is more asset than OToken in the pool.
     * OToken is minted and swapped for asset against the pool,
     * more OToken is minted and added back into the pool with the swapped out asset.
     * The OToken/asset price is > 1.0 so OToken is being sold at a premium.
     * @param _oTokenAmount Amount of OToken to swap into the pool.
     */
    function swapOTokensToPool(uint256 _oTokenAmount)
        external
        onlyStrategist
        nonReentrant
        improvePoolBalance
        skimPool
    {
        require(_oTokenAmount > 0, "Must swap something");

        // 1. Mint OToken so it can be swapped into the pool

        // There can be OToken in the strategy from skimming the pool
        uint256 oTokenInStrategy = IERC20(oToken).balanceOf(address(this));
        require(
            _oTokenAmount >= oTokenInStrategy,
            "Too much OToken in strategy"
        );
        uint256 oTokenToMint = _oTokenAmount - oTokenInStrategy;

        // Mint the required OToken tokens to this strategy
        IVault(vaultAddress).mintForStrategy(oTokenToMint);

        // 2. Swap OToken for asset against the pool
        _swapExactTokensForTokens(_oTokenAmount, oToken, asset);

        // The asset is from the swap and any asset that was sitting in the strategy
        uint256 assetDepositAmount = IERC20(asset).balanceOf(address(this));

        // 3. Add asset and OToken back to the pool in proportion to the pool's reserves
        (uint256 oTokenDepositAmount, uint256 lpTokens) = _deposit(
            assetDepositAmount
        );

        // Ensure solvency of the vault
        _solvencyAssert();

        // Emit event for the minted OToken tokens
        emit Deposit(oToken, pool, oTokenToMint + oTokenDepositAmount);
        // Emit event for the swap
        emit SwapOTokensToPool(
            oTokenToMint,
            assetDepositAmount,
            oTokenDepositAmount,
            lpTokens
        );
    }

    /***************************************
                Assets and Rewards
    ****************************************/

    /**
     * @notice Get the asset value of assets in the strategy and Algebra pool.
     * The value of the assets in the pool is calculated assuming the pool is balanced.
     * This way the value can not be manipulated by changing the pool's token balances.
     * @param _asset      Address of the asset token
     * @return balance    Total value in asset.
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        require(_asset == asset, "Unsupported asset");

        // asset balance needed here for the balance check that happens from vault during depositing.
        balance = IERC20(asset).balanceOf(address(this));

        // This assumes 1 gauge LP token = 1 pool LP token
        uint256 lpTokens = IGauge(gauge).balanceOf(address(this));
        if (lpTokens == 0) return balance;

        // Add the strategy’s share of the asset and OToken tokens in the Algebra pool if the pool was balanced.
        balance += _lpValue(lpTokens);
    }

    /**
     * @notice Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == asset;
    }

    /**
     * @notice Collect accumulated SWPx (and other) rewards and send to the Harvester.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // Collect SWPx rewards from the gauge
        IGauge(gauge).getReward();

        _collectRewardTokens();
    }

    /***************************************
        Internal Algebra Pool and Gauge Functions
    ****************************************/

    /**
     * @dev Calculate the required amount of OToken to mint based on the asset amount.
     * This ensures the proportion of OToken tokens being added to the pool matches the proportion of asset tokens.
     * For example, if the added asset tokens is 10% of existing asset tokens in the pool,
     * then the OToken tokens being added should also be 10% of the OToken tokens in the pool.
     * @param _assetAmount Amount of asset tokens to be added to the pool.
     * @return oTokenAmount Amount of OToken tokens to be minted and added to the pool.
     */
    function _calcTokensToMint(uint256 _assetAmount)
        internal
        view
        returns (uint256 oTokenAmount)
    {
        (uint256 assetReserves, uint256 oTokenReserves) = _getPoolReserves();
        require(assetReserves > 0, "Empty pool");

        // OToken to add = (asset being added * OToken in pool) / asset in pool
        oTokenAmount = (_assetAmount * oTokenReserves) / assetReserves;
    }

    /**
     * @dev Calculate how much pool LP tokens to burn to get the required amount of asset tokens back
     * from the pool.
     * @param _assetAmount Amount of asset tokens to be removed from the pool.
     * @return lpTokens Amount of Algebra pool LP tokens to burn.
     */
    function _calcTokensToBurn(uint256 _assetAmount)
        internal
        view
        returns (uint256 lpTokens)
    {
        /* The Algebra pool proportionally returns the reserve tokens when removing liquidity.
         * First, calculate the proportion of required asset tokens against the pools asset reserves.
         * That same proportion is used to calculate the required amount of pool LP tokens.
         * For example, if the required asset tokens is 10% of the pool's asset reserves,
         * then 10% of the pool's LP supply needs to be burned.
         *
         * Because we are doing balanced removal we should be making profit when removing liquidity in a
         * pool tilted to either side.
         *
         * Important: A downside is that the Strategist / Governor needs to be
         * cognizant of not removing too much liquidity. And while the proposal to remove liquidity
         * is being voted on, the pool tilt might change so much that the proposal that has been valid while
         * created is no longer valid.
         */

        (uint256 assetReserves, ) = _getPoolReserves();
        require(assetReserves > 0, "Empty pool");

        lpTokens = (_assetAmount * IPair(pool).totalSupply()) / assetReserves;
        lpTokens += 1; // Add 1 to ensure we get enough LP tokens with rounding
    }

    /**
     * @dev Deposit asset and OToken liquidity to the Algebra pool
     * and stake the pool's LP token in the gauge.
     * @param _assetAmount Amount of asset to deposit.
     * @param _oTokenAmount Amount of OToken to deposit.
     * @return lpTokens Amount of Algebra pool LP tokens minted.
     */
    function _depositToPoolAndGauge(uint256 _assetAmount, uint256 _oTokenAmount)
        internal
        returns (uint256 lpTokens)
    {
        // Transfer asset to the pool
        IERC20(asset).safeTransfer(pool, _assetAmount);
        // Transfer OToken to the pool
        IERC20(oToken).safeTransfer(pool, _oTokenAmount);

        // Mint LP tokens from the pool
        lpTokens = IPair(pool).mint(address(this));

        // Deposit the pool's LP tokens into the gauge
        IGauge(gauge).deposit(lpTokens);
    }

    /**
     * @dev Withdraw pool LP tokens from the gauge and remove asset and OToken from the pool.
     * @param _lpTokens Amount of Algebra pool LP tokens to withdraw from the gauge
     */
    function _withdrawFromGaugeAndPool(uint256 _lpTokens) internal {
        require(
            IGauge(gauge).balanceOf(address(this)) >= _lpTokens,
            "Not enough LP tokens in gauge"
        );

        // Withdraw pool LP tokens from the gauge
        IGauge(gauge).withdraw(_lpTokens);

        // Transfer the pool LP tokens to the pool
        IERC20(pool).safeTransfer(pool, _lpTokens);

        // Burn the LP tokens and transfer the asset and OToken back to the strategy
        IPair(pool).burn(address(this));
    }

    /**
     * @dev Withdraw all pool LP tokens from the gauge when it's in emergency mode
     * and remove asset and OToken from the pool.
     */
    function _emergencyWithdrawFromGaugeAndPool() internal {
        // Withdraw all pool LP tokens from the gauge
        IGauge(gauge).emergencyWithdraw();

        // Get the pool LP tokens in strategy
        uint256 _lpTokens = IERC20(pool).balanceOf(address(this));

        // Transfer the pool LP tokens to the pool
        IERC20(pool).safeTransfer(pool, _lpTokens);

        // Burn the LP tokens and transfer the asset and OToken back to the strategy
        IPair(pool).burn(address(this));
    }

    /**
     * @dev Swap exact amount of tokens for another token against the pool.
     * @param _amountIn Amount of tokens to swap into the pool.
     * @param _tokenIn Address of the token going into the pool.
     * @param _tokenOut Address of the token being swapped out of the pool.
     */
    function _swapExactTokensForTokens(
        uint256 _amountIn,
        address _tokenIn,
        address _tokenOut
    ) internal {
        // Transfer in tokens to the pool
        IERC20(_tokenIn).safeTransfer(pool, _amountIn);

        // Calculate how much out tokens we get from the swap
        uint256 amountOut = IPair(pool).getAmountOut(_amountIn, _tokenIn);

        // Safety check that we are dealing with the correct pool tokens
        require(
            (_tokenIn == asset && _tokenOut == oToken) ||
                (_tokenIn == oToken && _tokenOut == asset),
            "Unsupported swap"
        );

        uint256 amount0;
        uint256 amount1;

        // Work out the correct order of the amounts for the pool
        if (_tokenIn == asset) {
            if (oTokenPoolIndex == 0) {
                amount0 = amountOut;
                amount1 = 0;
            } else {
                amount0 = 0;
                amount1 = amountOut;
            }
        } else {
           if (oTokenPoolIndex == 0) {
                amount0 = 0;
                amount1 = amountOut;
            } else {
                amount0 = amountOut;
                amount1 = 0;   
            }
        }

        // Perform the swap on the pool
        IPair(pool).swap(amount0, amount1, address(this), new bytes(0));

        // The slippage protection against the amount out is indirectly done
        // via the improvePoolBalance
    }

    /// @dev Calculate the value of a LP position in a Algebra stable pool
    /// if the pool was balanced.
    /// @param _lpTokens Amount of LP tokens in the Algebra pool
    /// @return value The asset value of the LP tokens when the pool is balanced
    function _lpValue(uint256 _lpTokens) internal view returns (uint256 value) {
        // Get total supply of LP tokens
        uint256 totalSupply = IPair(pool).totalSupply();
        if (totalSupply == 0) return 0;

        // Get the current reserves of the pool
        (uint256 assetReserves, uint256 oTokenReserves) = _getPoolReserves();

        // Calculate the invariant of the pool assuming both tokens have 18 decimals.
        // k is scaled to 18 decimals.
        uint256 k = _invariant(assetReserves, oTokenReserves);

        // If x = y, let’s denote x = y = z (where z is the common reserve value)
        // Substitute z into the invariant:
        // k = z^3 * z + z * z^3
        // k = 2 * z^4
        // Going back the other way to calculate the common reserve value z
        // z = (k / 2) ^ (1/4)
        // the total value of the pool when x = y is 2 * z, which is 2 * (k / 2) ^ (1/4)
        uint256 zSquared = sqrt((k * 1e18) / 2); // 18 + 18 = 36 decimals becomes 18 decimals after sqrt
        uint256 z = sqrt(zSquared * 1e18); //  18 + 18 = 36 decimals becomes 18 decimals after sqrt
        uint256 totalValueOfPool = 2 * z;

        // lp value = lp tokens * value of pool  / total supply
        value = (_lpTokens * totalValueOfPool) / totalSupply;
    }

    /**
     * @dev Compute the invariant for a Algebra stable pool.
     * This assumed both x and y tokens are to 18 decimals which is checked in the constructor.
     * invariant: k = x^3 * y + x * y^3
     * @dev This implementation is copied from Algebra's Pair contract.
     * @param _x The amount of asset tokens in the pool
     * @param _y The amount of the OToken tokens in the pool
     * @return k The invariant of the Algebra stable pool
     */
    function _invariant(uint256 _x, uint256 _y)
        internal
        pure
        returns (uint256 k)
    {
        uint256 _a = (_x * _y) / PRECISION;
        uint256 _b = ((_x * _x) / PRECISION + (_y * _y) / PRECISION);
        // slither-disable-next-line divide-before-multiply
        k = (_a * _b) / PRECISION;
    }

    /**
     * @dev Checks that the protocol is solvent, protecting from a rogue Strategist / Guardian that can
     * keep rebalancing the pool in both directions making the protocol lose a tiny amount of
     * funds each time.
     *
     * Protocol must be at least SOLVENCY_THRESHOLD (99,8 %) backed in order for the rebalances to
     * function.
     */
    function _solvencyAssert() internal view {
        uint256 _totalVaultValue = IVault(vaultAddress).totalValue();
        uint256 _totalSupply = IERC20(oToken).totalSupply();

        if (
            _totalSupply > 0 &&
            _totalVaultValue.divPrecisely(_totalSupply) < SOLVENCY_THRESHOLD
        ) {
            revert("Protocol insolvent");
        }
    }

    /**
     * @dev Get the reserves of the pool no matter the order of tokens in the underlying
     * Algebra pool.
     * @return assetReserves The reserves of the asset token in the pool.
     * @return oTokenReserves The reserves of the OToken token in the pool.
     */
    function _getPoolReserves()
        internal
        view
        returns (uint256 assetReserves, uint256 oTokenReserves)
    {
        (uint256 reserve0, uint256 reserve1, ) = IPair(pool).getReserves();
        assetReserves = oTokenPoolIndex == 0 ? reserve1 : reserve0;
        oTokenReserves = oTokenPoolIndex == 0 ? reserve0 : reserve1;
    }

    /***************************************
                    Setters
    ****************************************/

    /**
     * @notice Set the maximum deviation from the OToken/asset peg (1e18) before deposits are reverted.
     * @param _maxDepeg the OToken/asset price from peg (1e18) in 18 decimals.
     * eg 0.01e18 or 1e16 is 1% which is 100 basis points.
     */
    function setMaxDepeg(uint256 _maxDepeg) external onlyGovernor {
        maxDepeg = _maxDepeg;

        emit MaxDepegUpdated(_maxDepeg);
    }

    /***************************************
                    Approvals
    ****************************************/

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

    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {}

    function _approveBase() internal {
        // Approve Algebra gauge contract to transfer Algebra pool LP tokens
        // This is needed for deposits of Algebra pool LP tokens into the gauge.
        // slither-disable-next-line unused-return
        IPair(pool).approve(address(gauge), type(uint256).max);
    }
}
