// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title SwapX Algorithmic Market Maker (AMO) Strategy
 * @notice AMO strategy for the SwapX OS/wS stable pool
 * @author Origin Protocol Inc
 */
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../../utils/StableMath.sol";
import { sqrt } from "../../utils/PRBMath.sol";
import { IBasicToken } from "../../interfaces/IBasicToken.sol";
import { IPair } from "../../interfaces/sonic/ISwapXPair.sol";
import { IGauge } from "../../interfaces/sonic/ISwapXGauge.sol";
import { IVault } from "../../interfaces/IVault.sol";

contract SonicSwapXAMOStrategy is InitializableAbstractStrategy {
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    using SafeCast for uint256;

    /**
     * @notice a threshold under which the contract no longer allows for the protocol to manually rebalance.
     *      Guarding against a strategist / guardian being taken over and with multiple transactions
     *      draining the protocol funds.
     */
    uint256 public constant SOLVENCY_THRESHOLD = 0.998 ether;

    /// @notice Precision for the SwapX Stable AMM (sAMM) invariant k.
    uint256 public constant PRECISION = 1e18;

    /// @notice Address of the Wrapped S (wS) token.
    address public immutable ws;

    /// @notice Address of the OS token contract.
    address public immutable os;

    /// @notice Address of the SwapX Stable pool contract.
    address public immutable pool;

    /// @notice Address of the SwapX Gauge contract.
    address public immutable gauge;

    event SwapOTokensToPool(
        uint256 osMinted,
        uint256 wsLiquidity,
        uint256 osLiquidity,
        uint256 lpTokens
    );
    event SwapAssetsToPool(
        uint256 wsSwapped,
        uint256 lpTokens,
        uint256 osBurnt
    );

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
     * @dev Skim the SwapX pool in case any extra wS or OS tokens were added
     */
    modifier skimPool() {
        IPair(pool).skim(address(this));
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
        (uint256 wsReservesBefore, uint256 osReservesBefore, ) = IPair(pool)
            .getReserves();
        // diff = wS balance - OS balance
        int256 diffBefore = wsReservesBefore.toInt256() -
            osReservesBefore.toInt256();

        _;

        // Get the asset and OToken balances in the pool
        (uint256 wsReservesAfter, uint256 osReservesAfter, ) = IPair(pool)
            .getReserves();
        // diff = wS balance - OS balance
        int256 diffAfter = wsReservesAfter.toInt256() -
            osReservesAfter.toInt256();

        if (diffBefore == 0) {
            require(diffAfter == 0, "Position balance is worsened");
        } else if (diffBefore < 0) {
            // If the pool was originally imbalanced in favor of OS, then
            // we want to check that the pool is now more balanced
            require(diffAfter <= 0, "Assets overshot peg");
            require(diffBefore < diffAfter, "OTokens balance worse");
        } else if (diffBefore > 0) {
            // If the pool was originally imbalanced in favor of wS, then
            // we want to check that the pool is now more balanced
            require(diffAfter >= 0, "OTokens overshot peg");
            require(diffAfter < diffBefore, "Assets balance worse");
        }
    }

    /**
     * @param _baseConfig The `platformAddress` is the address of the SwapX pool.
     * The `vaultAddress` is the address of the Origin Sonic Vault.
     * @param _os Address of the OS token.
     * @param _ws Address of the Wrapped S (wS) token.
     * @param _gauge Address of the SwapX gauge for the pool.
     */
    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _os,
        address _ws,
        address _gauge
    ) InitializableAbstractStrategy(_baseConfig) {
        // Check the pool tokens are correct
        require(
            IPair(_baseConfig.platformAddress).token0() == _ws &&
                IPair(_baseConfig.platformAddress).token1() == _os,
            "Incorrect pool tokens"
        );
        // Checked both tokens are to 18 decimals
        require(
            IBasicToken(_ws).decimals() == 18 &&
                IBasicToken(_os).decimals() == 18,
            "Incorrect token decimals"
        );
        // Check the SwapX pool is a Stable AMM (sAMM)
        require(
            IPair(_baseConfig.platformAddress).isStable() == true,
            "Pool not stable"
        );
        // Check the gauge is for the pool
        require(
            IGauge(_gauge).TOKEN() == _baseConfig.platformAddress,
            "Incorrect gauge"
        );

        // Set the immutable variables
        os = _os;
        ws = _ws;
        pool = _baseConfig.platformAddress;
        gauge = _gauge;

        // This is an implementation contract. The governor is set in the proxy contract.
        _setGovernor(address(0));
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as SwapX strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of SWPx token
     */
    function initialize(address[] calldata _rewardTokenAddresses)
        external
        onlyGovernor
        initializer
    {
        address[] memory pTokens = new address[](1);
        pTokens[0] = pool;

        address[] memory _assets = new address[](1);
        _assets[0] = ws;

        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            pTokens
        );

        _approveBase();
    }

    /***************************************
                    Deposit
    ****************************************/

    /**
     * @notice Deposit Wrapped S (wS) into the SwapX pool
     * @param _asset Address of Wrapped S (wS) contract.
     * @param _amount Amount of Wrapped S (wS) to deposit.
     */
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
        skimPool
    {
        _deposit(_asset, _amount);
    }

    function _deposit(address _wS, uint256 _wsAmount) internal {
        require(_wsAmount > 0, "Must deposit something");
        require(_wS == ws, "Unsupported asset");

        // Calculate the required amount of OS to mint based on the wS amount.
        uint256 osLiquidity = _calcTokensToMint(_wsAmount);

        // Mint the required OS tokens to this strategy
        IVault(vaultAddress).mintForStrategy(osLiquidity);

        // Add wS and OS liquidity to the pool and stake in gauge
        _depositToPoolAndGauge(_wsAmount, osLiquidity);

        // Ensure solvency of the vault
        _solvencyAssert();

        // Emit event for the deposited wS tokens
        emit Deposit(_wS, pool, _wsAmount);
        // Emit event for the minted OS tokens
        emit Deposit(os, pool, osLiquidity);
    }

    /**
     * @notice Deposit the strategy's entire balance of Wrapped S (wS) into the pool
     */
    function depositAll() external override onlyVault nonReentrant skimPool {
        uint256 balance = IERC20(ws).balanceOf(address(this));
        if (balance > 0) {
            _deposit(ws, balance);
        }
    }

    /***************************************
                    Withdraw
    ****************************************/

    /**
     * @notice Withdraw wS and OS from the SwapX pool, burn the OS,
     * and transfer the wS to the recipient.
     * @param _recipient Address to receive withdrawn asset which is normally the Vault.
     * @param _asset Address of the Wrapped S (wS) contract.
     * @param _wsAmount Amount of Wrapped S (wS) to withdraw.
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _wsAmount
    ) external override onlyVault nonReentrant skimPool {
        require(_wsAmount > 0, "Must withdraw something");
        require(_asset == ws, "Unsupported asset");

        // Calculate how much pool LP tokens to burn to get the required amount of wS tokens back
        uint256 lpTokens = _calcTokensToBurn(_wsAmount);

        // Withdraw pool LP tokens from the gauge and remove assets from from the pool
        _withdrawFromGaugeAndPool(lpTokens);

        // Burn all the removed OS and any that was left in the strategy
        uint256 osToBurn = IERC20(os).balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(osToBurn);

        // Transfer wS to the recipient
        // Note there can be a dust amount of wS left in the strategy as
        // the burn of the pool's LP tokens is rounded up
        require(
            IERC20(ws).balanceOf(address(this)) >= _wsAmount,
            "Not enough wS removed from pool"
        );
        IERC20(ws).safeTransfer(_recipient, _wsAmount);

        // Ensure solvency of the vault
        _solvencyAssert();

        // Emit event for the withdrawn wS tokens
        emit Withdrawal(_asset, pool, _wsAmount);
        // Emit event for the burnt OS tokens
        emit Withdrawal(os, pool, osToBurn);
    }

    /**
     * @notice Withdraw all pool LP tokens from the gauge,
     * remove all wS and OS from the SwapX pool,
     * burn all the OS tokens,
     * and transfer all the wS to the Vault contract.
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

        // Withdraw pool LP tokens from the gauge and remove assets from from the pool
        _withdrawFromGaugeAndPool(lpTokens);

        // Burn all OS in this strategy contract
        uint256 osToBurn = IERC20(os).balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(osToBurn);

        // Get the strategy contract's wS balance.
        // This includes all that was removed from the SwapX pool and
        // any that was sitting in the strategy contract before the removal.
        uint256 wsBalance = IERC20(ws).balanceOf(address(this));
        IERC20(ws).safeTransfer(vaultAddress, wsBalance);

        // Emit event for the withdrawn wS tokens
        emit Withdrawal(ws, pool, wsBalance);
        // Emit event for the burnt OS tokens
        emit Withdrawal(os, pool, osToBurn);
    }

    /***************************************
                Pool Rebalancing
    ****************************************/

    /** @notice Used when there is more OS than wS in the pool.
     * wS and OS is removed from the pool, the received wS is swapped for OS
     * and the left over OS in the strategy is burnt.
     * The OS/wS price is < 1.0 so OS is being bought at a discount.
     * @param _wsAmount Amount of Wrapped S (wS) to swap into the pool.
     */
    function swapAssetsToPool(uint256 _wsAmount)
        external
        onlyStrategist
        nonReentrant
        improvePoolBalance
        skimPool
    {
        require(_wsAmount > 0, "Must swap something");

        // 1. Partially remove liquidity so there’s enough wS for the swap

        // Calculate how much pool LP tokens to burn to get the required amount of wS tokens back
        uint256 lpTokens = _calcTokensToBurn(_wsAmount);
        require(lpTokens > 0, "No LP tokens to burn");

        _withdrawFromGaugeAndPool(lpTokens);

        // 2. Swap wS for OS against the pool
        // Swap exact amount of wS for OS against the pool
        // There can be a dust amount of wS left in the strategy as the burn of the pool's LP tokens is rounded up
        _swapExactTokensForTokens(_wsAmount, ws, os);

        // 3. Burn all the OS left in the strategy from the remove liquidity and swap
        uint256 osToBurn = IERC20(os).balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(osToBurn);

        // Ensure solvency of the vault
        _solvencyAssert();

        emit SwapAssetsToPool(_wsAmount, lpTokens, osToBurn);
    }

    /**
     * @notice Used when there is more wS than OS in the pool.
     * OS is minted and swapped for wS against the pool,
     * more OS is minted and added back into the pool with the swapped out wS.
     * The OS/wS price is > 1.0 so OS is being sold at a premium.
     * @param _osAmount Amount of OS to swap into the pool.
     */
    function swapOTokensToPool(uint256 _osAmount)
        external
        onlyStrategist
        nonReentrant
        improvePoolBalance
        skimPool
    {
        require(_osAmount > 0, "Must swap something");

        // 1. Mint OS so it can be swapped into the pool

        // There shouldn't be any OS in the strategy but just in case
        uint256 osInStrategy = IERC20(os).balanceOf(address(this));
        require(_osAmount >= osInStrategy, "Too much OS in strategy");
        uint256 osToMint = _osAmount - osInStrategy;

        // Mint the required OS tokens to this strategy
        IVault(vaultAddress).mintForStrategy(osToMint);

        // 2. Swap OS for wS against the pool
        _swapExactTokensForTokens(_osAmount, os, ws);

        // 3. Add wS and OS back to the pool in proportion to the pool's reserves

        // The wS is from the swap and any wS that was sitting in the strategy
        uint256 wsLiquidity = IERC20(ws).balanceOf(address(this));
        // Calculate the required amount of OS to mint based on the wS amount.
        uint256 osLiquidity = _calcTokensToMint(wsLiquidity);

        // Mint more OS to this strategy so they can then be added to the pool
        IVault(vaultAddress).mintForStrategy(osLiquidity);

        // Add wS and OS liquidity to the pool and stake in gauge
        uint256 lpTokens = _depositToPoolAndGauge(wsLiquidity, osLiquidity);

        // Ensure solvency of the vault
        _solvencyAssert();

        emit SwapOTokensToPool(osToMint, wsLiquidity, osLiquidity, lpTokens);
    }

    /***************************************
                Assets and Rewards
    ****************************************/

    /**
     * @notice Get the wS value of assets in the strategy and SwapX pool.
     * The value of the assets in the pool is calculated assuming the pool is balanced.
     * This way the value can not be manipulated by changing the pool's token balances.
     * @param _asset      Address of the Wrapped S (wS) token
     * @return balance    Total value in wS.
     */
    function checkBalance(address _asset)
        public
        view
        override
        returns (uint256 balance)
    {
        require(_asset == ws, "Unsupported asset");

        // wS balance needed here for the balance check that happens from vault during depositing.
        balance = IERC20(ws).balanceOf(address(this));

        // This assumes 1 gauge LP token = 1 pool LP token
        uint256 lpTokens = IGauge(gauge).balanceOf(address(this));
        if (lpTokens == 0) return balance;

        // Add the strategy’s share of the wS and OS tokens in the SwapX pool if the pool was balanced.
        balance += _lpValue(lpTokens);
    }

    /**
     * @notice Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == ws;
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
        Internal SwapX Pool and Gauge Functions
    ****************************************/

    /**
     * @dev Calculate the required amount of OS to mint based on the wS amount.
     * This ensures the proportion of OS tokens being added to the pool matches the proportion of wS tokens.
     * For example, if the added wS tokens is 10% of existing wS tokens in the pool,
     * then the OS tokens being added should also be 10% of the OS tokens in the pool.
     * @param _wsAmount Amount of Wrapped S (wS) to be added to the pool.
     * @return osAmount Amount of OS to be minted and added to the pool.
     */
    function _calcTokensToMint(uint256 _wsAmount)
        internal
        view
        returns (uint256 osAmount)
    {
        (uint256 wsReserves, uint256 osReserves, ) = IPair(pool).getReserves();
        require(wsReserves > 0, "Empty pool");

        // OS to add = (wS being added * OS in pool) / wS in pool
        osAmount = (_wsAmount * osReserves) / wsReserves;
    }

    /**
     * @dev Calculate how much pool LP tokens to burn to get the required amount of wS tokens back
     * from the pool.
     * @param _wsAmount Amount of Wrapped S (wS) to be removed from the pool.
     * @return lpTokens Amount of SwapX pool LP tokens to burn.
     */
    function _calcTokensToBurn(uint256 _wsAmount)
        internal
        view
        returns (uint256 lpTokens)
    {
        /* The rate between coins in the pool determines the rate at which pool returns
         * tokens when doing balanced removal (remove_liquidity call). And by knowing how much wS
         * we want we can determine how much of OS we receive by removing liquidity.
         *
         * Because we are doing balanced removal we should be making profit when removing liquidity in a
         * pool tilted to either side.
         *
         * Important: A downside is that the Strategist / Governor needs to be
         * cognizant of not removing too much liquidity. And while the proposal to remove liquidity
         * is being voted on, the pool tilt might change so much that the proposal that has been valid while
         * created is no longer valid.
         */

        (uint256 wsReserves, , ) = IPair(pool).getReserves();
        require(wsReserves > 0, "Empty pool");

        lpTokens = (_wsAmount * IPair(pool).totalSupply()) / wsReserves;
        lpTokens += 1; // Add 1 to ensure we get enough LP tokens with rounding
    }

    /**
     * @dev Deposit Wrapped S (wS) and OS liquidity to the SwapX pool
     * and stake the pool's LP token in the gauge.
     * @param _wsAmount Amount of Wrapped S (wS) to deposit.
     * @param osAmount Amount of OS to deposit.
     * @return lpTokens Amount of SwapX pool LP tokens minted.
     */
    function _depositToPoolAndGauge(uint256 _wsAmount, uint256 osAmount)
        internal
        returns (uint256 lpTokens)
    {
        // Transfer wS to the pool
        IERC20(ws).safeTransfer(pool, _wsAmount);
        // Transfer OS to the pool
        IERC20(os).safeTransfer(pool, osAmount);

        // Mint LP tokens from the pool
        lpTokens = IPair(pool).mint(address(this));

        // Deposit the pool's LP tokens into the gauge
        IGauge(gauge).deposit(lpTokens);
    }

    /**
     * @dev Withdraw pool LP tokens from the gauge and remove wS and OS from the pool.
     * @param lpTokens Amount of SwapX pool LP tokens to withdraw from the gauge
     */
    function _withdrawFromGaugeAndPool(uint256 lpTokens) internal {
        require(
            IGauge(gauge).balanceOf(address(this)) >= lpTokens,
            "Not enough LP tokens in gauge"
        );

        // Withdraw pool LP tokens from the gauge
        IGauge(gauge).withdraw(lpTokens);

        // Transfer the pool LP tokens to the pool
        IERC20(pool).safeTransfer(pool, lpTokens);

        // Burn the LP tokens and transfer the wS and OS back to the strategy
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
            (_tokenIn == ws && _tokenOut == os) ||
                (_tokenIn == os && _tokenOut == ws),
            "Unsupported swap"
        );

        // Work out the correct order of the amounts for the pool
        (uint256 amount0, uint256 amount1) = _tokenIn == ws
            ? (uint256(0), amountOut)
            : (amountOut, 0);

        // Perform the swap on the pool
        IPair(pool).swap(amount0, amount1, address(this), new bytes(0));

        // The slippage protection against the amount out is indirectly done
        // via the improvePoolBalance
    }

    /// @dev Calculate the value of a LP position in a SwapX stable pool
    /// if the pool was balanced.
    /// @param lpTokens Amount of LP tokens in the SwapX pool
    /// @return value The wS value of the LP tokens when the pool is balanced
    function _lpValue(uint256 lpTokens) internal view returns (uint256 value) {
        // Get total supply of LP tokens
        uint256 totalSupply = IPair(pool).totalSupply();
        if (totalSupply == 0) return 0;

        // Get the current reserves of the pool
        (uint256 wsReserves, uint256 osReserves, ) = IPair(pool).getReserves();

        // Calculate the invariant of the pool assuming both tokens have 18 decimals.
        // k is scaled to 18 decimals.
        uint256 k = _invariant(wsReserves, osReserves);

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
        value = (lpTokens * totalValueOfPool) / totalSupply;
    }

    /**
     * @dev Compute the invariant for a SwapX stable pool.
     * This assumed both x and y tokens are to 18 decimals which is checked in the constructor.
     * invariant: k = x^3 * y + x * y^3
     * @dev This implementation is copied from SwapX's Pair contract.
     * @param x The amount of Wrapped S (wS) tokens in the pool
     * @param y The amount of the OS tokens in the pool
     * @return k The invariant of the SwapX stable pool
     */
    function _invariant(uint256 x, uint256 y)
        internal
        pure
        returns (uint256 k)
    {
        uint256 _a = (x * y) / PRECISION;
        uint256 _b = ((x * x) / PRECISION + (y * y) / PRECISION);
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
        uint256 _totalSupply = IERC20(os).totalSupply();

        if (
            _totalSupply > 0 &&
            _totalVaultValue.divPrecisely(_totalSupply) < SOLVENCY_THRESHOLD
        ) {
            revert("Protocol insolvent");
        }
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
        // Approve pool for OS and wS (required for adding liquidity)
        // slither-disable-next-line unused-return
        IERC20(os).approve(platformAddress, type(uint256).max);
        // slither-disable-next-line unused-return
        IERC20(ws).approve(platformAddress, type(uint256).max);

        // Approve SwapX gauge contract to transfer SwapX pool LP tokens
        // This is needed for deposits of SwapX pool LP tokens into the gauge.
        // slither-disable-next-line unused-return
        IPair(pool).approve(address(gauge), type(uint256).max);
    }
}
