// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Aerodrome AMO strategy
 * @author Origin Protocol Inc
 */
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../../utils/StableMath.sol";

import { ISugarHelper } from "../../interfaces/aerodrome/ISugarHelper.sol";
import { INonfungiblePositionManager } from "../../interfaces/aerodrome/INonfungiblePositionManager.sol";
import { ISwapRouter } from "../../interfaces/aerodrome/ISwapRouter.sol";
import { ICLPool } from "../../interfaces/aerodrome/ICLPool.sol";
import { ICLGauge } from "../../interfaces/aerodrome/ICLGauge.sol";
import { IVault } from "../../interfaces/IVault.sol";

contract AerodromeAMOStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    /************************************************
            Important (!) setup configuration
    *************************************************/

    /**
     * In order to be able to remove a reasonable amount of complexity from the contract one of the
     * preconditions for this contract to function correctly is to have an outside account mint a small
     * amount of liquidity in the tick space where the contract will deploy's its liquidity and then send
     * that NFT LP position to a dead address (transfer to zero address not allowed.) See example of such
     * NFT LP token:
     * https://basescan.org/token/0x827922686190790b37229fd06084350e74485b72?a=413296#inventory
     */

    /***************************************
            Storage slot members
    ****************************************/

    /// @notice tokenId of the liquidity position
    uint256 public tokenId;
    /// @dev Minimum amount of tokens the strategy would be able to withdraw from the pool.
    ///      minimum amount of tokens are withdrawn at a 1:1 price
    uint256 public underlyingAssets;
    /// @notice Marks the start of the interval that defines the allowed range of WETH share in
    /// the pre-configured pool's liquidity ticker
    uint256 public allowedWethShareStart;
    /// @notice Marks the end of the interval that defines the allowed range of WETH share in
    /// the pre-configured pool's liquidity ticker
    uint256 public allowedWethShareEnd;
    /// @dev reserved for inheritance
    int256[46] private __reserved;

    /***************************************
          Constants, structs and events
    ****************************************/

    /// @notice The address of the Wrapped ETH (WETH) token contract
    address public immutable WETH;
    /// @notice The address of the OETHb token contract
    address public immutable OETHb;
    /// @notice lower tick set to -1 representing the price of 1.0001 of WETH for 1 OETHb.
    int24 public immutable lowerTick;
    /// @notice lower tick set to 0 representing the price of 1.0000 of WETH for 1 OETHb.
    int24 public immutable upperTick;
    /// @notice tick spacing of the pool (set to 1)
    int24 public immutable tickSpacing;
    /// @notice the swapRouter for performing swaps
    ISwapRouter public immutable swapRouter;
    /// @notice the underlying AMO Slipstream pool
    ICLPool public immutable clPool;
    /// @notice the gauge for the corresponding Slipstream pool (clPool)
    /// @dev can become an immutable once the gauge is created on the base main-net
    ICLGauge public immutable clGauge;
    /// @notice the Position manager contract that is used to manage the pool's position
    INonfungiblePositionManager public immutable positionManager;
    /// @notice helper contract for liquidity and ticker math
    ISugarHelper public immutable helper;
    /// @notice sqrtRatioX96TickLower
    /// @dev tick lower has value -1 and represents the lowest price of WETH priced in OETHb. Meaning the pool
    /// offers less than 1 OETHb for 1 WETH. In other terms to get 1 OETHB the swap needs to offer 1.0001 WETH
    /// this is where purchasing OETHb with WETH within the liquidity position is most expensive
    uint160 public immutable sqrtRatioX96TickLower;
    /// @notice sqrtRatioX96TickHigher
    /// @dev tick higher has value 0 and represents 1:1 price parity of WETH to OETHb
    uint160 public immutable sqrtRatioX96TickHigher;
    /// @dev tick closest to 1:1 price parity
    ///      Correctly assessing which tick is closer to 1:1 price parity is important since it affects
    ///      the way we calculate the underlying assets in check Balance. The underlying aerodrome pool
    ///      orders the tokens depending on the values of their addresses. If OETH token is token0 in the pool
    ///      then sqrtRatioX96TickClosestToParity=sqrtRatioX96TickLower. If it is token1 in the pool then
    ///      sqrtRatioX96TickClosestToParity=sqrtRatioX96TickHigher
    uint160 public immutable sqrtRatioX96TickClosestToParity;

    /// @dev a threshold under which the contract no longer allows for the protocol to rebalance. Guarding
    ///      against a strategist / guardian being taken over and with multiple transactions draining the
    ///      protocol funds.
    uint256 public constant SOLVENCY_THRESHOLD = 0.998 ether;

    error NotEnoughWethForSwap(uint256 wethBalance, uint256 requiredWeth); // 0x989e5ca8
    error NotEnoughWethLiquidity(uint256 wethBalance, uint256 requiredWeth); // 0xa6737d87
    error PoolRebalanceOutOfBounds(
        uint256 currentPoolWethShare,
        uint256 allowedWethShareStart,
        uint256 allowedWethShareEnd
    ); // 0x3681e8e0
    error OutsideExpectedTickRange(int24 currentTick); // 0x5a2eba75

    event PoolRebalanced(uint256 currentPoolWethShare);

    event PoolWethShareIntervalUpdated(
        uint256 allowedWethShareStart,
        uint256 allowedWethShareEnd
    );

    event LiquidityRemoved(
        uint256 withdrawLiquidityShare,
        uint256 removedWETHAmount,
        uint256 removedOETHbAmount,
        uint256 wethAmountCollected,
        uint256 oethbAmountCollected,
        uint256 underlyingAssets
    );

    event LiquidityAdded(
        uint256 wethAmountDesired,
        uint256 oethbAmountDesired,
        uint256 wethAmountSupplied,
        uint256 oethbAmountSupplied,
        uint256 tokenId,
        uint256 underlyingAssets
    );

    event UnderlyingAssetsUpdated(uint256 underlyingAssets);

    /**
     * @dev Un-stakes the token from the gauge for the execution duration of
     * the function and after that re-stakes it back in.
     *
     * It is important that the token is unstaked and owned by the strategy contract
     * during any liquidity altering operations and that it is re-staked back into the
     * gauge after liquidity changes. If the token fails to re-stake back to the
     * gauge it is not earning incentives.
     */
    // all functions using this modifier are used by functions with reentrancy check
    // slither-disable-start reentrancy-no-eth
    modifier gaugeUnstakeAndRestake() {
        // because of solidity short-circuit _isLpTokenStakedInGauge doesn't get called
        // when tokenId == 0
        if (tokenId != 0 && _isLpTokenStakedInGauge()) {
            clGauge.withdraw(tokenId);
        }
        _;
        // because of solidity short-circuit _isLpTokenStakedInGauge doesn't get called
        // when tokenId == 0
        if (tokenId != 0 && !_isLpTokenStakedInGauge()) {
            /**
             * It can happen that a withdrawal (or a full withdrawal) transactions would
             * remove all of the liquidity from the token with a NFT token still existing.
             * In that case the token can not be staked into the gauge, as some liquidity
             * needs to be added to it first.
             */
            if (_getLiquidity() > 0) {
                // if token liquidity changes the positionManager requires re-approval.
                // to any contract pre-approved to handle the token.
                positionManager.approve(address(clGauge), tokenId);
                clGauge.deposit(tokenId);
            }
        }
    }

    // slither-disable-end reentrancy-no-eth

    /// @notice the constructor
    /// @dev This contract is intended to be used as a proxy. To prevent the
    ///      potential confusion of having a functional implementation contract
    ///      the constructor has the `initializer` modifier. This way the
    ///      `initialize` function can not be called on the implementation contract.
    ///      For the same reason the implementation contract also has the governor
    ///      set to a zero address.
    /// @param _stratConfig the basic strategy configuration
    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _oethbAddress Address of the Erc20 OETHb Token contract
    /// @param _swapRouter Address of the Aerodrome Universal Swap Router
    /// @param _nonfungiblePositionManager Address of position manager to add/remove
    ///         the liquidity
    /// @param _clPool Address of the Aerodrome concentrated liquidity pool
    /// @param _clGauge Address of the Aerodrome slipstream pool gauge
    /// @param _sugarHelper Address of the Aerodrome Sugar helper contract
    /// @param _lowerBoundingTick Smaller bounding tick of our liquidity position
    /// @param _upperBoundingTick Larger bounding tick of our liquidity position
    /// @param _tickClosestToParity Tick that is closer to 1:1 price parity
    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _wethAddress,
        address _oethbAddress,
        address _swapRouter,
        address _nonfungiblePositionManager,
        address _clPool,
        address _clGauge,
        address _sugarHelper,
        int24 _lowerBoundingTick,
        int24 _upperBoundingTick,
        int24 _tickClosestToParity
    ) initializer InitializableAbstractStrategy(_stratConfig) {
        require(
            _lowerBoundingTick == _tickClosestToParity ||
                _upperBoundingTick == _tickClosestToParity,
            "Misconfigured tickClosestToParity"
        );
        require(
            ICLPool(_clPool).token0() == _wethAddress,
            "Only WETH supported as token0"
        );
        require(
            ICLPool(_clPool).token1() == _oethbAddress,
            "Only OETHb supported as token1"
        );
        int24 _tickSpacing = ICLPool(_clPool).tickSpacing();
        // when we generalize AMO we might support other tick spacings
        require(_tickSpacing == 1, "Unsupported tickSpacing");

        WETH = _wethAddress;
        OETHb = _oethbAddress;
        swapRouter = ISwapRouter(_swapRouter);
        positionManager = INonfungiblePositionManager(
            _nonfungiblePositionManager
        );
        clPool = ICLPool(_clPool);
        clGauge = ICLGauge(_clGauge);
        helper = ISugarHelper(_sugarHelper);
        sqrtRatioX96TickLower = ISugarHelper(_sugarHelper).getSqrtRatioAtTick(
            _lowerBoundingTick
        );
        sqrtRatioX96TickHigher = ISugarHelper(_sugarHelper).getSqrtRatioAtTick(
            _upperBoundingTick
        );
        sqrtRatioX96TickClosestToParity = ISugarHelper(_sugarHelper)
            .getSqrtRatioAtTick(_tickClosestToParity);

        lowerTick = _lowerBoundingTick;
        upperTick = _upperBoundingTick;
        tickSpacing = _tickSpacing;

        // prevent implementation contract to be governed
        _setGovernor(address(0));
    }

    /**
     * @notice initialize function, to set up initial internal state
     * @param _rewardTokenAddresses Address of reward token for platform
     */
    function initialize(address[] memory _rewardTokenAddresses)
        external
        onlyGovernor
        initializer
    {
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            new address[](0),
            new address[](0)
        );
    }

    /***************************************
                  Configuration 
    ****************************************/

    /**
     * @notice Set allowed pool weth share interval. After the rebalance happens
     * the share of WETH token in the ticker needs to be withing the specifications
     * of the interval.
     *
     * @param _allowedWethShareStart Start of WETH share interval expressed as 18 decimal amount
     * @param _allowedWethShareEnd End of WETH share interval expressed as 18 decimal amount
     */
    function setAllowedPoolWethShareInterval(
        uint256 _allowedWethShareStart,
        uint256 _allowedWethShareEnd
    ) external onlyGovernor {
        require(
            _allowedWethShareStart < _allowedWethShareEnd,
            "Invalid interval"
        );
        // can not go below 1% weth share
        require(_allowedWethShareStart > 0.01 ether, "Invalid interval start");
        // can not go above 95% weth share
        require(_allowedWethShareEnd < 0.95 ether, "Invalid interval end");

        allowedWethShareStart = _allowedWethShareStart;
        allowedWethShareEnd = _allowedWethShareEnd;
        emit PoolWethShareIntervalUpdated(
            allowedWethShareStart,
            allowedWethShareEnd
        );
    }

    /***************************************
                Periphery utils
    ****************************************/

    function _isLpTokenStakedInGauge() internal view returns (bool) {
        require(tokenId != 0, "Missing NFT LP token");

        address owner = positionManager.ownerOf(tokenId);
        require(
            owner == address(clGauge) || owner == address(this),
            "Unexpected token owner"
        );
        return owner == address(clGauge);
    }

    /***************************************
               Strategy overrides 
    ****************************************/

    /**
     * @notice Deposit an amount of assets into the strategy contract. Calling deposit doesn't
     *         automatically deposit funds into the underlying Aerodrome pool
     * @param _asset   Address for the asset
     * @param _amount  Units of asset to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    /**
     * @notice Deposit WETH to the strategy contract. This function does not add liquidity to the
     *         underlying Aerodrome pool.
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 _wethBalance = IERC20(WETH).balanceOf(address(this));
        if (_wethBalance > 1e12) {
            _deposit(WETH, _wethBalance);
        }
    }

    /**
     * @dev Deposit WETH to the contract. This function doesn't deposit the liquidity to the
     *      pool, that is done via the rebalance call.
     * @param _asset Address of the asset to deposit
     * @param _amount Amount of assets to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal {
        require(_asset == WETH, "Unsupported asset");
        require(_amount > 0, "Must deposit something");
        emit Deposit(_asset, address(0), _amount);

        // if the pool price is not within the expected interval leave the WETH on the contract
        // as to not break the mints
        (bool _isExpectedRange, ) = _checkForExpectedPoolPrice(false);
        if (_isExpectedRange) {
            // deposit funds into the underlying pool
            _rebalance(0, false, 0);
        }
    }

    /**
     * @notice Rebalance the pool to the desired token split and Deposit any WETH on the contract to the
     * underlying aerodrome pool. Print the required amount of corresponding OETHb. After the rebalancing is
     * done burn any potentially remaining OETHb tokens still on the strategy contract.
     *
     * This function has a slightly different behaviour depending on the status of the underlying Aerodrome
     * slipstream pool. The function consists of the following 3 steps:
     * 1. withdrawPartialLiquidity -> so that moving the activeTrading price via  a swap is cheaper
     * 2. swapToDesiredPosition   -> move active trading price in the pool to be able to deposit WETH & OETHb
     *                               tokens with the desired pre-configured shares
     * 3. addLiquidity            -> add liquidity into the pool respecting share split configuration
     *
     * Scenario 1: When there is no liquidity in the pool from the strategy but there is from other LPs then
     *             only step 1 is skipped. (It is important to note that liquidity needs to exist in the configured
     *             strategy tick ranges in order for the swap to be possible) Step 3 mints new liquidity position
     *             instead of adding to an existing one.
     * Scenario 2: When there is strategy's liquidity in the pool all 3 steps are taken
     *
     *
     * Exact _amountToSwap, _swapWeth & _minTokenReceived parameters shall be determined by simulating the
     * transaction off-chain. The strategy checks that after the swap the share of the tokens is in the
     * expected ranges.
     *
     * @param _amountToSwap The amount of the token to swap
     * @param _swapWeth Swap using WETH when true, use OETHb when false
     * @param _minTokenReceived Slippage check -> minimum amount of token expected in return
     */
    function rebalance(
        uint256 _amountToSwap,
        bool _swapWeth,
        uint256 _minTokenReceived
    ) external nonReentrant onlyGovernorOrStrategist {
        _rebalance(_amountToSwap, _swapWeth, _minTokenReceived);
    }

    function _rebalance(
        uint256 _amountToSwap,
        bool _swapWeth,
        uint256 _minTokenReceived
    ) internal {
        /**
         * Would be nice to check if there is any total liquidity in the pool before performing this swap
         * but there is no easy way to do that in UniswapV3:
         * - clPool.liquidity() -> only liquidity in the active tick
         * - asset[1&2].balanceOf(address(clPool)) -> will include uncollected tokens of LP providers
         *   after their liquidity position has been decreased
         */

        /**
         * When rebalance is called for the first time there is no strategy
         * liquidity in the pool yet. The liquidity removal is thus skipped.
         * Also execute this function when WETH is required for the swap.
         */
        if (tokenId != 0 && _swapWeth && _amountToSwap > 0) {
            _ensureWETHBalance(_amountToSwap);
        }

        // in some cases we will just want to add liquidity and not issue a swap to move the
        // active trading position within the pool
        if (_amountToSwap > 0) {
            _swapToDesiredPosition(_amountToSwap, _swapWeth, _minTokenReceived);
        }
        // calling check liquidity early so we don't get unexpected errors when adding liquidity
        // in the later stages of this function
        _checkForExpectedPoolPrice(true);

        _addLiquidity();

        // this call shouldn't be necessary, since adding liquidity shouldn't affect the active
        // trading price. It is a defensive programming measure.
        (, uint256 _wethSharePct) = _checkForExpectedPoolPrice(true);

        // revert if protocol insolvent
        _solvencyAssert();

        emit PoolRebalanced(_wethSharePct);
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
        uint256 _totalOethbSupply = IERC20(OETHb).totalSupply();

        if (
            _totalVaultValue.divPrecisely(_totalOethbSupply) <
            SOLVENCY_THRESHOLD
        ) {
            revert("Protocol insolvent");
        }
    }

    /**
     * @dev Decrease partial or all liquidity from the pool.
     * @param _liquidityToDecrease The amount of liquidity to remove expressed in 18 decimal point
     */
    function _removeLiquidity(uint256 _liquidityToDecrease)
        internal
        gaugeUnstakeAndRestake
    {
        require(_liquidityToDecrease > 0, "Must remove some liquidity");

        uint128 _liquidity = _getLiquidity();
        // need to convert to uint256 since intermittent result is to big for uint128 to handle
        uint128 _liquidityToRemove = uint256(_liquidity)
            .mulTruncate(_liquidityToDecrease)
            .toUint128();

        /**
         * There is no liquidity to remove -> exit function early. This can happen after a
         * withdraw/withdrawAll removes all of the liquidity while retaining the NFT token.
         */
        if (_liquidity == 0 || _liquidityToRemove == 0) {
            return;
        }

        (uint256 _amountWeth, uint256 _amountOethb) = positionManager
            .decreaseLiquidity(
                // Both expected amounts can be 0 since we don't really care if any swaps
                // happen just before the liquidity removal.
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: tokenId,
                    liquidity: _liquidityToRemove,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                })
            );

        (
            uint256 _amountWethCollected,
            uint256 _amountOethbCollected
        ) = positionManager.collect(
                INonfungiblePositionManager.CollectParams({
                    tokenId: tokenId,
                    recipient: address(this),
                    amount0Max: type(uint128).max, // defaults to all tokens owed
                    amount1Max: type(uint128).max // defaults to all tokens owed
                })
            );

        _updateUnderlyingAssets();

        emit LiquidityRemoved(
            _liquidityToDecrease,
            _amountWeth, //removedWethAmount
            _amountOethb, //removedOethbAmount
            _amountWethCollected,
            _amountOethbCollected,
            underlyingAssets
        );

        _burnOethbOnTheContract();
    }

    /**
     * @dev Perform a swap so that after the swap the ticker has the desired WETH to OETHb token share.
     */
    function _swapToDesiredPosition(
        uint256 _amountToSwap,
        bool _swapWeth,
        uint256 _minTokenReceived
    ) internal {
        IERC20 _tokenToSwap = IERC20(_swapWeth ? WETH : OETHb);
        uint256 _balance = _tokenToSwap.balanceOf(address(this));

        if (_balance < _amountToSwap) {
            // This should never trigger since _ensureWETHBalance will already
            // throw an error if there is not enough WETH
            if (_swapWeth) {
                revert NotEnoughWethForSwap(_balance, _amountToSwap);
            }
            // if swapping OETHb
            uint256 mintForSwap = _amountToSwap - _balance;
            IVault(vaultAddress).mintForStrategy(mintForSwap);
        }

        // approve the specific amount of WETH required
        if (_swapWeth) {
            IERC20(WETH).approve(address(swapRouter), _amountToSwap);
        }

        // Swap it
        swapRouter.exactInputSingle(
            // sqrtPriceLimitX96 is just a rough sanity check that we are within 0 -> 1 tick
            // a more fine check is performed in _checkForExpectedPoolPrice
            // Note: this needs further work if we want to generalize this approach
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(_tokenToSwap),
                tokenOut: _swapWeth ? OETHb : WETH,
                tickSpacing: tickSpacing, // set to 1
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: _amountToSwap,
                amountOutMinimum: _minTokenReceived, // slippage check
                sqrtPriceLimitX96: _swapWeth
                    ? sqrtRatioX96TickLower
                    : sqrtRatioX96TickHigher
            })
        );

        /**
         * In the interest of each function in _rebalance to leave the contract state as
         * clean as possible the OETHb tokens here are burned. This decreases the
         * dependence where `_swapToDesiredPosition` function relies on later functions
         * (`addLiquidity`) to burn the OETHb. Reducing the risk of error introduction.
         */
        _burnOethbOnTheContract();
    }

    /**
     * @dev Add liquidity into the pool in the pre-configured WETH to OETHb share ratios
     * defined by the allowedPoolWethShareStart|End interval. This function will respect
     * liquidity ratios when there is no liquidity yet in the pool. If liquidity is already
     * present then it relies on the `_swapToDesiredPosition` function in a step before
     * to already move the trading price to desired position (with some tolerance).
     */
    // rebalance already has re-entrency checks
    // slither-disable-start reentrancy-no-eth
    function _addLiquidity() internal gaugeUnstakeAndRestake {
        uint256 _wethBalance = IERC20(WETH).balanceOf(address(this));
        uint256 _oethbBalance = IERC20(OETHb).balanceOf(address(this));
        // don't deposit small liquidity amounts
        if (_wethBalance <= 1e12) {
            return;
        }

        uint160 _currentPrice = getPoolX96Price();
        /**
         * Sanity check active trading price is positioned within our desired tick.
         *
         * We revert when price is equal to the lower tick even though that is still
         * a valid amount in regards to ticker position by Sugar.estimateAmount call.
         * Current price equaling tick bound at the 1:1 price parity results in
         * uint overfow when calculating the OETHb balance to deposit.
         */
        if (
            _currentPrice <= sqrtRatioX96TickLower ||
            _currentPrice >= sqrtRatioX96TickHigher
        ) {
            revert OutsideExpectedTickRange(getCurrentTradingTick());
        }

        /**
         * If estimateAmount1 call fails it could be due to _currentPrice being really
         * close to a tick and amount1 is a larger number than the sugar helper is able
         * to compute.
         *
         * If token addresses were reversed estimateAmount0 would be required here
         */
        uint256 _oethbRequired = helper.estimateAmount1(
            _wethBalance,
            address(0), // no need to pass pool address when current price is specified
            _currentPrice,
            lowerTick,
            upperTick
        );

        if (_oethbRequired > _oethbBalance) {
            IVault(vaultAddress).mintForStrategy(
                _oethbRequired - _oethbBalance
            );
        }

        // approve the specific amount of WETH required
        IERC20(WETH).approve(address(positionManager), _wethBalance);

        uint256 _wethAmountSupplied;
        uint256 _oethbAmountSupplied;
        if (tokenId == 0) {
            (
                tokenId,
                ,
                _wethAmountSupplied,
                _oethbAmountSupplied
            ) = positionManager.mint(
                /** amount0Min & amount1Min are left at 0 because slippage protection is ensured by the
                 * _checkForExpectedPoolPrice
                 *›
                 * Also sqrtPriceX96 is 0 because the pool is already created
                 * non zero amount attempts to create a new instance of the pool
                 */
                INonfungiblePositionManager.MintParams({
                    token0: WETH,
                    token1: OETHb,
                    tickSpacing: tickSpacing,
                    tickLower: lowerTick,
                    tickUpper: upperTick,
                    amount0Desired: _wethBalance,
                    amount1Desired: _oethbRequired,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: address(this),
                    deadline: block.timestamp,
                    sqrtPriceX96: 0
                })
            );
        } else {
            (, _wethAmountSupplied, _oethbAmountSupplied) = positionManager
                .increaseLiquidity(
                    /** amount0Min & amount1Min are left at 0 because slippage protection is ensured by the
                     * _checkForExpectedPoolPrice
                     */
                    INonfungiblePositionManager.IncreaseLiquidityParams({
                        tokenId: tokenId,
                        amount0Desired: _wethBalance,
                        amount1Desired: _oethbRequired,
                        amount0Min: 0,
                        amount1Min: 0,
                        deadline: block.timestamp
                    })
                );
        }

        _updateUnderlyingAssets();
        emit LiquidityAdded(
            _wethBalance, // wethAmountDesired
            _oethbRequired, // oethbAmountDesired
            _wethAmountSupplied, // wethAmountSupplied
            _oethbAmountSupplied, // oethbAmountSupplied
            tokenId, // tokenId
            underlyingAssets
        );

        // burn remaining OETHb
        _burnOethbOnTheContract();
    }

    // slither-disable-end reentrancy-no-eth

    /**
     * @dev Check that the Aerodrome pool price is within the expected
     *      parameters.
     *      This function works whether the strategy contract has liquidity
     *      position in the pool or not. The function returns _wethSharePct
     *      as a gas optimization measure.
     * @param throwException  when set to true the function throws an exception
     *        when pool's price is not within expected range.
     * @return _isExpectedRange  Bool expressing price is within expected range
     * @return _wethSharePct  Share of WETH owned by this strategy contract in the
     *         configured ticker.
     */
    function _checkForExpectedPoolPrice(bool throwException)
        internal
        view
        returns (bool _isExpectedRange, uint256 _wethSharePct)
    {
        require(
            allowedWethShareStart != 0 && allowedWethShareEnd != 0,
            "Weth share interval not set"
        );

        uint160 _currentPrice = getPoolX96Price();

        /**
         * First check we are in expected tick range
         *
         * We revert even though price being equal to the lower tick would still
         * count being within lower tick for the purpose of Sugar.estimateAmount calls
         */
        if (
            _currentPrice <= sqrtRatioX96TickLower ||
            _currentPrice >= sqrtRatioX96TickHigher
        ) {
            if (throwException) {
                revert OutsideExpectedTickRange(getCurrentTradingTick());
            }
            return (false, 0);
        }

        // 18 decimal number expressed WETH tick share
        _wethSharePct = _getWethShare(_currentPrice);

        if (
            _wethSharePct < allowedWethShareStart ||
            _wethSharePct > allowedWethShareEnd
        ) {
            if (throwException) {
                revert PoolRebalanceOutOfBounds(
                    _wethSharePct,
                    allowedWethShareStart,
                    allowedWethShareEnd
                );
            }
            return (false, _wethSharePct);
        }

        return (true, _wethSharePct);
    }

    /**
     * Burns any OETHb tokens remaining on the strategy contract
     */
    function _burnOethbOnTheContract() internal {
        uint256 _oethbBalance = IERC20(OETHb).balanceOf(address(this));
        if (_oethbBalance > 1e12) {
            IVault(vaultAddress).burnForStrategy(_oethbBalance);
        }
    }

    /// @dev This function assumes there are no uncollected tokens in the clPool owned by the strategy contract.
    ///      For that reason any liquidity withdrawals must also collect the tokens.
    function _updateUnderlyingAssets() internal {
        if (tokenId == 0) {
            underlyingAssets = 0;
            emit UnderlyingAssetsUpdated(underlyingAssets);
            return;
        }

        uint128 _liquidity = _getLiquidity();

        /**
         * Our net value represent the smallest amount of tokens we are able to extract from the position
         * given our liquidity.
         *
         * The least amount of tokens extraditable from the position is where the active trading price is
         * at the ticker 0 meaning the pool is offering 1:1 trades between WETH & OETHb. At that moment the pool
         * consists completely of OETHb and no WETH.
         *
         * The more swaps from WETH -> OETHb happen on the pool the more the price starts to move towards the -1
         * ticker making OETHb (priced in WETH) more expensive.
         *
         * An additional note: when liquidity is 0 then the helper returns 0 for both token amounts. And the
         * function set underlying assets to 0.
         */
        (uint256 _wethAmount, uint256 _oethbAmount) = helper
            .getAmountsForLiquidity(
                sqrtRatioX96TickClosestToParity, // sqrtRatioX96
                sqrtRatioX96TickLower, // sqrtRatioAX96
                sqrtRatioX96TickHigher, // sqrtRatioBX96
                _liquidity
            );

        require(_wethAmount == 0, "Non zero wethAmount");
        underlyingAssets = _oethbAmount;
        emit UnderlyingAssetsUpdated(underlyingAssets);
    }

    /**
     * @dev This function removes the appropriate amount of liquidity to assure that the required
     * amount of WETH is available on the contract
     *
     * @param _amount  WETH balance required on the contract
     */
    function _ensureWETHBalance(uint256 _amount) internal {
        uint256 _wethBalance = IERC20(WETH).balanceOf(address(this));
        if (_wethBalance >= _amount) {
            return;
        }

        require(tokenId != 0, "No liquidity available");
        uint256 _additionalWethRequired = _amount - _wethBalance;
        (uint256 _wethInThePool, ) = getPositionPrincipal();

        if (_wethInThePool < _additionalWethRequired) {
            revert NotEnoughWethLiquidity(
                _wethInThePool,
                _additionalWethRequired
            );
        }

        uint256 shareOfWethToRemove = Math.min(
            _additionalWethRequired.divPrecisely(_wethInThePool) + 1,
            1e18
        );
        _removeLiquidity(shareOfWethToRemove);
    }

    /**
     * @notice Withdraw an `amount` of assets from the platform and
     *         send to the `_recipient`.
     * @param _recipient  Address to which the asset should be sent
     * @param _asset      WETH address
     * @param _amount     Amount of WETH to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_asset == WETH, "Unsupported asset");
        require(_recipient == vaultAddress, "Only withdraw to vault allowed");

        _ensureWETHBalance(_amount);

        _withdraw(_recipient, _amount);
    }

    /**
     * @notice Withdraw WETH and sends it to the Vault.
     */
    function withdrawAll() external override onlyVault nonReentrant {
        if (tokenId != 0) {
            _removeLiquidity(1e18);
        }

        uint256 _balance = IERC20(WETH).balanceOf(address(this));
        if (_balance > 0) {
            _withdraw(vaultAddress, _balance);
        }
    }

    function _withdraw(address _recipient, uint256 _amount) internal {
        require(_amount > 0, "Must withdraw something");
        require(_recipient == vaultAddress, "Only withdraw to vault allowed");

        IERC20(WETH).safeTransfer(_recipient, _amount);
        emit Withdrawal(WETH, address(0), _amount);
    }

    /**
     * @dev Collect the AERO token from the gauge
     */
    function _collectRewardTokens() internal override {
        if (tokenId != 0 && _isLpTokenStakedInGauge()) {
            clGauge.getReward(tokenId);
        }
        super._collectRewardTokens();
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == WETH;
    }

    /**
     * @dev Approve the spending of all assets
     */
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        // to add liquidity to the clPool
        IERC20(OETHb).approve(address(positionManager), type(uint256).max);
        // to be able to rebalance using the swapRouter
        IERC20(OETHb).approve(address(swapRouter), type(uint256).max);

        /* the behaviour of this strategy has slightly changed and WETH could be
         * present on the contract between the transactions. For that reason we are
         * un-approving WETH to the swapRouter & positionManager and only approving
         * the required amount before a transaction
         */
        IERC20(WETH).approve(address(swapRouter), 0);
        IERC20(WETH).approve(address(positionManager), 0);
    }

    /***************************************
            Balances and Fees
    ****************************************/

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256)
    {
        require(_asset == WETH, "Only WETH supported");

        // we could in theory deposit to the strategy and forget to call rebalance in the same
        // governance transaction batch. In that case the WETH that is on the strategy contract
        // also needs to be accounted for.
        uint256 _wethBalance = IERC20(WETH).balanceOf(address(this));
        // just paranoia check, in case there is OETHb in the strategy that for some reason hasn't
        // been burned yet.
        uint256 _oethbBalance = IERC20(OETHb).balanceOf(address(this));
        return underlyingAssets + _wethBalance + _oethbBalance;
    }

    /**
     * @dev Returns the balance of both tokens in a given position (excluding fees)
     * @return _amountWeth Amount of WETH in position
     * @return _amountOethb Amount of OETHb in position
     */
    function getPositionPrincipal()
        public
        view
        returns (uint256 _amountWeth, uint256 _amountOethb)
    {
        if (tokenId == 0) {
            return (0, 0);
        }

        uint160 _sqrtRatioX96 = getPoolX96Price();
        (_amountWeth, _amountOethb) = helper.principal(
            positionManager,
            tokenId,
            _sqrtRatioX96
        );
    }

    /**
     * @notice Returns the current pool price in X96 format
     * @return _sqrtRatioX96 Pool price
     */
    function getPoolX96Price() public view returns (uint160 _sqrtRatioX96) {
        (_sqrtRatioX96, , , , , ) = clPool.slot0();
    }

    /**
     * @notice Returns the current active trading tick of the underlying pool
     * @return _currentTick Current pool trading tick
     */
    function getCurrentTradingTick() public view returns (int24 _currentTick) {
        (, _currentTick, , , , ) = clPool.slot0();
    }

    /**
     * @notice Returns the percentage of WETH liquidity in the configured ticker
     *         owned by this strategy contract.
     * @return uint256 1e18 denominated percentage expressing the share
     */
    function getWETHShare() external view returns (uint256) {
        uint160 _currentPrice = getPoolX96Price();
        return _getWethShare(_currentPrice);
    }

    /**
     * @notice Returns the amount of liquidity in the contract's LP position
     * @return _liquidity Amount of liquidity in the position
     */
    function _getLiquidity() internal view returns (uint128 _liquidity) {
        if (tokenId == 0) {
            revert("No LP position");
        }

        (, , , , , , , _liquidity, , , , ) = positionManager.positions(tokenId);
    }

    function _getWethShare(uint160 _currentPrice)
        internal
        view
        returns (uint256)
    {
        /**
         * If estimateAmount1 call fails it could be due to _currentPrice being really
         * close to a tick and amount1 too big to compute.
         *
         * If token addresses were reversed estimateAmount0 would be required here
         */
        uint256 _normalizedWethAmount = 1 ether;
        uint256 _correspondingOethAmount = helper.estimateAmount1(
            _normalizedWethAmount,
            address(0), // no need to pass pool address when current price is specified
            _currentPrice,
            lowerTick,
            upperTick
        );

        // 18 decimal number expressed weth tick share
        return
            _normalizedWethAmount.divPrecisely(
                _normalizedWethAmount + _correspondingOethAmount
            );
    }

    /***************************************
            Hidden functions
    ****************************************/
    /// @inheritdoc InitializableAbstractStrategy
    function setPTokenAddress(address, address) external override {
        // The pool tokens can never change.
        revert("Unsupported method");
    }

    /// @inheritdoc InitializableAbstractStrategy
    function removePToken(uint256) external override {
        // The pool tokens can never change.
        revert("Unsupported method");
    }

    /**
     * @dev Not supported
     */
    function _abstractSetPToken(address, address) internal override {
        // the deployer shall call safeApproveAllTokens() to set necessary approvals
        revert("Unsupported method");
    }

    /***************************************
            ERC721 management
    ****************************************/

    /// @notice Callback function for whenever a NFT is transferred to this contract
    //  solhint-disable-next-line max-line-length
    /// Ref: https://docs.openzeppelin.com/contracts/3.x/api/token/erc721#IERC721Receiver-onERC721Received-address-address-uint256-bytes-
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
