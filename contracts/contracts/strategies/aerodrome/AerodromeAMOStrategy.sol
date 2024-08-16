// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Aerodrome AMO strategy
 * @author Origin Protocol Inc
 */
import "@openzeppelin/contracts/utils/math/Math.sol";
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

    /***************************************
            Storage slot members
    ****************************************/

    /// @notice tokenId of the liquidity position
    uint256 public tokenId;
    /// @dev Minimum amount of tokens the strategy would be able to withdraw from the pool.
    ///      minimum amount of tokens are withdrawn at a 1:1 price
    uint256 public underlyingAssets;
    /**
     * @notice Specifies WETH to OETHb ratio the strategy contract aims for after rebalancing 
     * as 18 decimal point
     * 
     * e.g. 0.2e18 means 20% WETH 80% OETHb
     */
    uint256 public poolWethShare;
    /**
     * @notice Specifies how the target WETH share of the pool defined by the `poolWethShare` can
     * vary from the configured value after rebalancing. Expressed as 18 decimal point
     */
    uint256 public poolWethShareVarianceAllowed;
    /**
     * Share of liquidity to remove on rebalance expressed in 18 decimal points
     */
    uint128 public withdrawLiquidityShare;
    /// @dev reserved for inheritance
    int256[45] private __reserved;

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
    /// @notice sqrtRatioX96Tick0
    /// @dev tick 0 has value -1 and represents the lowest price of WETH priced in OETHb. Meaning the pool
    /// offers less than 1 OETHb for 1 WETH. In other terms to get 1 OETHB the swap needs to offer 1.0001 WETH
    /// this is where purchasing OETHb with WETH within the liquidity position is most expensive
    uint160 public immutable sqrtRatioX96Tick0;
    /// @notice sqrtRatioX96Tick1
    /// @dev tick 1 has value 0 and represents 1:1 price parity of WETH to OETHb 
    uint160 public immutable sqrtRatioX96Tick1;
    /// @dev tick closest to 1:1 price parity
    ///      Correctly assesing which tick is closer to 1:1 price parity is important since it affects
    ///      the way we calculate the underlying assets in check Balance
    uint160 public immutable sqrtRatioX96TickClosestToParity;

    error NotEnoughWethForSwap(uint256 wethBalance, uint256 requiredWeth); // 0x989e5ca8
    error NotEnoughWethLiquidity(uint256 wethBalance, uint256 requiredWeth);
    error PoolRebalanceOutOfBounds(
        uint256 currentPoolWethShare,
        uint256 requiredPoolWethShare,
        uint256 WETHPositionBalance,
        uint256 OETHbPositionBalance
    ); // 0x6c6108fb

    event PoolRebalanced(
        uint256 currentPoolWethShare,
        uint256 targetPoolWethShare,
        uint256 WETHPositionBalance,
        uint256 OETHbPositionBalance
    );
    
    event PoolWethShareUpdated(
        uint256 newWethShare
    );

    event PrincipalPositionBeforeSwap(
        uint256 WETHPositionBalance,
        uint256 OETHbPositionBalance
    );

    event PrincipalPositionAfterSwap(
        uint256 WETHPositionBalance,
        uint256 OETHbPositionBalance
    );

    event WithdrawLiqiudityShareUpdated(
        uint128 newWithdrawLiquidityShare
    );

    event PoolWethShareVarianceAllowedUpdated(
        uint256 poolWethShareVarianceAllowed
    );

    event LiquidityRemoved(
        uint128 withdrawLiquidityShare,
        uint256 removedWETHAmount,
        uint256 removedOETHbAmount,
        uint256 WETHAmountCollected,
        uint256 OETHbAmountCollected,
        uint256 underlyingAssets
    );

    event LiquidityTokenBurned(
        uint256 tokenId
    );

    event LiquidityAdded(
        uint256 WETHAmountDesired,
        uint256 OETHbAmountDesired,
        uint256 WETHAmountSupplied,
        uint256 OETHbAmountSupplied,
        uint256 tokenId,
        uint256 underlyingAssets
    );

    /**
     * @dev Verifies that the caller is the Governor, or Strategist.
     */
    modifier onlyGovernorOrStrategist() {
        require(
            msg.sender == governor() ||
            msg.sender == IVault(vaultAddress).strategistAddr(),
            "Not the Governor or Strategist"
        );
        _;
    }

    /// @notice the constructor
    /// @param _stratConfig the basic strategy configuration
    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _OETHbAddress Address of the Erc20 OETHb Token contract
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
        address _OETHbAddress,
        address _swapRouter,
        address _nonfungiblePositionManager,
        address _clPool,
        address _clGauge,
        address _sugarHelper,
        int24 _lowerBoundingTick,
        int24 _upperBoundingTick,
        int24 _tickClosestToParity
    ) InitializableAbstractStrategy(_stratConfig)
    {
        WETH = _wethAddress;
        OETHb = _OETHbAddress;
        swapRouter = ISwapRouter(_swapRouter);
        positionManager = INonfungiblePositionManager(
            _nonfungiblePositionManager
        );
        clPool = ICLPool(_clPool);
        clGauge = ICLGauge(_clGauge);
        helper = ISugarHelper(_sugarHelper);
        sqrtRatioX96Tick0 = ISugarHelper(_sugarHelper).getSqrtRatioAtTick(_lowerBoundingTick);
        sqrtRatioX96Tick1 = ISugarHelper(_sugarHelper).getSqrtRatioAtTick(_upperBoundingTick);
        sqrtRatioX96TickClosestToParity = ISugarHelper(_sugarHelper).getSqrtRatioAtTick(_tickClosestToParity);

        lowerTick = _lowerBoundingTick;
        upperTick = _upperBoundingTick;
        tickSpacing = 1;

        require(ICLPool(_clPool).token0() == _wethAddress, "Only WETH supported as token0");
        require(ICLPool(_clPool).token1() == _OETHbAddress, "Only OETHb supported as token1");
    }

    /**
     * @notice initialize function, to set up initial internal state
     * @param _rewardTokenAddresses Address of reward token for platform
     * @param _assets Addresses of initial supported assets
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address[] memory _rewardTokenAddresses,
        address[] memory _assets,
        address[] memory _pTokens
    ) external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            // these should all be empty
            new address[](0),
            new address[](0)
        );
    }

    /***************************************
                  Configuration 
    ****************************************/

    /**
     * @notice Set the new desired WETH share
     * @param _amount The new amount specified in basis points
     */
    function setPoolWethShare(uint256 _amount) external onlyGovernor {
        require(_amount < 1e18, "Invalid poolWethShare amount");
        require(_amount > 0, "Invalid poolWethShare amount");

        poolWethShare = _amount;
        emit PoolWethShareUpdated(_amount);
    }

    /**
     * @notice Specifies the amount of liquidity that is to be removed when 
     *         a rebalancing happens.
     * @param _amount The new amount specified in basis points
     */
    function setWithdrawLiquidityShare(uint128 _amount) external onlyGovernor {
        require(_amount < 1e18, "Invalid withdrawLiquidityShare amount");

        withdrawLiquidityShare = _amount;
        emit WithdrawLiqiudityShareUpdated(_amount);
    }

    /**
     * @notice Specifies how the target WETH share of the pool defined by the `poolWethShare` can
     *         vary from the configured value after rebalancing.
     * @param _amount The new amount specified in basis points
     */
    function setPoolWethShareVarianceAllowed(uint256 _amount) external onlyGovernor {
        // no sensible reason to ever allow this over 40%
        require(_amount < 0.4 ether, "Invalid poolWethShareVariance");

        poolWethShareVarianceAllowed = _amount;
        emit PoolWethShareVarianceAllowedUpdated(_amount);
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
     * @dev Deposit WETH to the contract. This function doesn't deposit the liquidity to the
     *      pool, that is done via the rebalance call.
     * @param _asset Address of the asset to deposit
     * @param _amount Amount of assets to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal {
        require(_asset == WETH, "Unsupported asset");
        require(_amount > 0, "Must deposit something");
        emit Deposit(_asset, address(0), _amount);
    }

    /**
     * @notice Rebalance the pool to the desired token split and Deposit any WETH on the contract to the
     * underlying aerodrome pool. Print the required amount of corresponding OETHb. After the rebalancing is 
     * done burn any potentially remaining OETHb tokens still on the strategy contract.
     * 
     * Exact _amountToSwap, _minTokenReceived & _swapWETH parameters shall be determined by simulating the 
     * transaction off-chain. The strategy checks that after the swap the share of the tokens is in the 
     * expected ranges.
     * 
     * @param _amountToSwap The amount of the token to swap
     * @param _minTokenReceived Slippage check -> minimum amount of token expected in return
     * @param _swapWETH Swap using WETH when true, use OETHb when false
     */
    function rebalance(uint256 _amountToSwap, uint256 _minTokenReceived, bool _swapWETH) external nonReentrant onlyGovernorOrStrategist {
        _rebalance(_amountToSwap, _minTokenReceived, _swapWETH);
    }

    /// @notice Only used for the initial deposit (or after calling withdrawAll) when there is no liquidity
    ///         in the [-1, 0] tick. This function is needed since we can not swap to the desired position within
    ///         the pool if there is no liquidity in the [-1, 0] ticker
    function depositLiquidity() external nonReentrant onlyGovernorOrStrategist {
        require(tokenId == 0, "Liquidity already deposited");
        _addLiquidity();
    }

    /**
     * @dev Rebalance the pool to the desired token split
     */
    function _rebalance(uint256 _amountToSwap, uint256 _minTokenReceived, bool _swapWETH) internal {
        _removePartialLiquidity(withdrawLiquidityShare);
        // in some cases we will just want to add liquidity and not issue a swap to move the 
        // active trading position within the pool
        if (_amountToSwap > 0) {
            _swapToDesiredPosition(_amountToSwap, _minTokenReceived, _swapWETH);
        }
        // calling check liquidity early so we don't get unexpected errors when adding liquidity
        // in the later stages of this function
        _checkLiquidityWithinExpectedShare();
        _addLiquidity();
        _checkLiquidityWithinExpectedShare();
    }

    /**
     * @dev Decrease partial liquidity from the pool.
     * @param _partialLiquidityToDecrease The amount of liquidity to remove expressed in 18 decimals
     */
    function _removePartialLiquidity(uint256 _partialLiquidityToDecrease) internal {
        require(_partialLiquidityToDecrease > 0, "Must remove some liquidity");
        require(_partialLiquidityToDecrease < 1e18, "Mustn't remove all liquidity");

        _removeLiquidity(_partialLiquidityToDecrease);
    }

    /**
     * @dev Remove all liquidity from the pool.
     */
    function _removeAllLiquidity() internal {
        _removeLiquidity(1e18);

        positionManager.burn(tokenId);
        tokenId = 0;
        emit LiquidityTokenBurned(tokenId);
    }

    /**
     * @dev Decrease partial or all liquidity from the pool.
     * @param _liquidityToDecrease The amount of liquidity to remove expressed in 18 decimal point
     */
    function _removeLiquidity(uint256 _liquidityToDecrease) internal {
        require(_liquidityToDecrease > 0, "Must remove some liquidity");

        // unstake the position from the gauge
        clGauge.withdraw(tokenId);

        uint128 liquidity = _getLiquidity();
        // need to convert to uint256 since intermittent result is to big for uint128 to handle
        uint128 liqudityToRemove = uint256(liquidity).mulTruncate(_liquidityToDecrease).toUint128();

        (uint256 amountWETH, uint256 amountOETHb) = positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liqudityToRemove,
                /**
                 * Both expected amounts can be 0 since we don't really care if any swaps
                 * happen just before the liquidity removal.
                 */
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );

        (uint256 amountWETHCollected, uint256 amountOETHbCollected) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max, // defaults to all tokens owed
                amount1Max: type(uint128).max  // defaults to all tokens owed
            })
        );

        updateUnderlyingAssets();

        emit LiquidityRemoved(
            withdrawLiquidityShare,
            amountWETH, //removedWETHbAmount
            amountOETHb, //removedOETHbAmount
            amountWETHCollected,
            amountOETHbCollected,
            underlyingAssets
        );
    }

    /**
     * @dev Perform a swap so that after the swap the ticker has the desired WETH to OETHb token share.
     */
    function _swapToDesiredPosition(uint256 _amountToSwap, uint256 _minTokenReceived, bool _swapWETH) internal {
        IERC20 tokenToSwap = IERC20(_swapWETH ? WETH : OETHb);
        uint256 balance = tokenToSwap.balanceOf(address(this));

        if(balance < _amountToSwap) {
            // if swapping OETHb
            if (!_swapWETH) {
               uint256 mintForSwap = _amountToSwap - balance;
               IVault(vaultAddress).mintForStrategy(mintForSwap);
            } else {
                revert NotEnoughWethForSwap(balance, _amountToSwap);
            }
        }

        // emit an event so it is easier to find correct values off-chain
        (uint256 WETHPositionBalance, uint256 OETHbPositionBalance) = getPositionPrincipal();
        emit PrincipalPositionBeforeSwap(WETHPositionBalance, OETHbPositionBalance);

        // Swap it
        swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(tokenToSwap),
                tokenOut: _swapWETH ? OETHb : WETH,
                tickSpacing: tickSpacing, // set to 1
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: _amountToSwap,
                amountOutMinimum: _minTokenReceived, // slippage check
                // just a rough sanity check that we are within 0 -> 1 tick
                // a more fine check is performed in _checkLiquidityWithinExpectedShare
                // TBD(!): this needs further work if we want to generalize this approach
                sqrtPriceLimitX96: _swapWETH ? sqrtRatioX96Tick0 : sqrtRatioX96Tick1
            })
        );

        // emit an event so it is easier to find correct values off-chain
        (WETHPositionBalance, OETHbPositionBalance) = getPositionPrincipal();
        emit PrincipalPositionAfterSwap(WETHPositionBalance, OETHbPositionBalance);
    }

    /**
     * @dev Perform a swap so that after the swap the ticker has the desired WETH to OETHb token share.
     */
    function _addLiquidity() internal {
        uint256 WETHBalance = IERC20(WETH).balanceOf(address(this));
        uint256 OETHbBalance = IERC20(OETHb).balanceOf(address(this));
        require(WETHBalance > 0, "Must add some WETH");
        uint256 OETHbRequired;

        if (tokenId == 0) {
            // supply token amounts according to target poolWethShare amount
            OETHbRequired = WETHBalance.divPrecisely(poolWethShare)
                .mulTruncate(1e18 - poolWethShare);

        } else {
            // supply the tokens to the pool according to the current position in the pool
            (uint256 WETHPositionBalance, uint256 OETHbPositionBalance) = getPositionPrincipal();

            require(OETHbPositionBalance > 0, "Can not calculate OETHb required");
            OETHbRequired = OETHbPositionBalance.divPrecisely(WETHPositionBalance).mulTruncate(WETHBalance);
        }

        if (OETHbRequired > OETHbBalance) {
            IVault(vaultAddress).mintForStrategy(OETHbRequired - OETHbBalance);
        }

        if (tokenId == 0) {
            uint160 sqrtRatioX96 = getPoolX96Price();

            (uint256 mintedTokenId, uint128 liquidity, uint256 WETHAmountSupplied, uint256 OETHbAmountSupplied) = positionManager.mint(
                INonfungiblePositionManager.MintParams({
                    token0: WETH,
                    token1: OETHb,
                    tickSpacing: 1,
                    tickLower: lowerTick,
                    tickUpper: upperTick,
                    amount0Desired: WETHBalance,
                    amount1Desired: OETHbRequired,
                    // we don't need slippage protection checking for that in _checkLiquidityWithinExpectedShare
                    amount0Min: 0,
                    // we don't need slippage protection checking for that in _checkLiquidityWithinExpectedShare
                    amount1Min: 0,
                    recipient: address(this),
                    deadline: block.timestamp,
                    // needs to be 0 because the pool is already created
                    // non zero amount attempts to create a new instance of the pool
                    sqrtPriceX96: 0
                })
            );

            tokenId = mintedTokenId;

            updateUnderlyingAssets();
            emit LiquidityAdded(
                WETHBalance, // WETHAmountDesired
                OETHbRequired, // OETHbAmountDesired
                WETHAmountSupplied, // WETHAmountSupplied
                OETHbAmountSupplied, // OETHbAmountSupplied
                mintedTokenId, // tokenId
                underlyingAssets
            );
        } else {

            (,uint256 WETHAmountSupplied, uint256 OETHbAmountSupplied) = positionManager.increaseLiquidity(
                INonfungiblePositionManager.IncreaseLiquidityParams({
                    tokenId: tokenId,
                    amount0Desired: WETHBalance,
                    amount1Desired: OETHbRequired,
                    // we don't need slippage protection checking for that in _checkLiquidityWithinExpectedShare
                    amount0Min: 0,
                    // we don't need slippage protection checking for that in _checkLiquidityWithinExpectedShare
                    amount1Min: 0,
                    deadline: block.timestamp
                })
            );

            updateUnderlyingAssets();
            emit LiquidityAdded(
                WETHBalance, // WETHAmountDesired
                OETHbRequired, // OETHbAmountDesired
                WETHAmountSupplied, // WETHAmountSupplied
                OETHbAmountSupplied, // OETHbAmountSupplied
                tokenId, // tokenId
                underlyingAssets
            );
        }

        // burn remaining OETHb
        _burnOETHbOnTheContract();
        positionManager.approve(address(clGauge), tokenId);
        clGauge.deposit(tokenId);
    }

    /**
     * @dev Check that the liquidity in the pool is withing the expected WETH to OETHb ratio
     */
    function _checkLiquidityWithinExpectedShare() internal {
        (uint256 WETHPositionBalance, uint256 OETHbPositionBalance) = getPositionPrincipal();
        require(WETHPositionBalance + OETHbPositionBalance > 0, "No liquidity in position");

        uint160 currentPrice = getPoolX96Price();
        // check we are in inspected tick range
        require(currentPrice >= sqrtRatioX96Tick0 && currentPrice <= sqrtRatioX96Tick1, "Not in expected tick range");

        uint256 currentWethShare = 0;
        if (WETHPositionBalance != 0) {
            currentWethShare = WETHPositionBalance.divPrecisely(WETHPositionBalance + OETHbPositionBalance);
        }

        uint256 wethDiff = Math.max(poolWethShare, currentWethShare) - Math.min(poolWethShare, currentWethShare);

        if (wethDiff < poolWethShareVarianceAllowed) {
            emit PoolRebalanced(
                currentWethShare,
                poolWethShare,
                WETHPositionBalance,
                OETHbPositionBalance
            );
        } else {
            revert PoolRebalanceOutOfBounds(
                currentWethShare,
                poolWethShare,
                WETHPositionBalance,
                OETHbPositionBalance
            );
        }
    }

    /**
     * Burns any lingering OETHb tokens still remaining on the contract
     */
    function _burnOETHbOnTheContract() internal {
        uint256 OETHbBalance = IERC20(OETHb).balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(OETHbBalance);
    }

    function updateUnderlyingAssets() internal {
        if (tokenId == 0) {
            underlyingAssets = 0;
        } else {
            uint128 liquidity = _getLiquidity();

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
             */
            (uint256 wethAmount, uint256 OETHbAmount) = helper.getAmountsForLiquidity(
                sqrtRatioX96TickClosestToParity, // sqrtRatioX96
                sqrtRatioX96Tick0,               // sqrtRatioAX96
                sqrtRatioX96Tick1,               // sqrtRatioBX96
                liquidity
            );

            require(wethAmount == 0, "Non zero wethAmount");
            underlyingAssets = OETHbAmount;
        }

    }

    /**
     * @notice Deposit all supported assets in this strategy contract to the platform
     */
    function depositAll()
        external
        override
        onlyVault
        nonReentrant 
    {
        _deposit(WETH, IERC20(WETH).balanceOf(address(this)));
    }

    /**
     * @notice Withdraw an `amount` of assets from the platform and
     * send to the `_recipient`.
     * @param _recipient         Address to which the asset should be sent
     * @param _asset             Address of the asset
     * @param _amount            Units of asset to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) 
        external
        override
        onlyVault
        nonReentrant
    {
        require(_asset == WETH, "Unsupported asset");
        require(_recipient == vaultAddress, "Only withdraw to vault allowed");

        uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
        if (wethBalance < _amount) {
            uint256 additionalWETHRequired = _amount - wethBalance;
            (uint256 WETHInThePool,) = getPositionPrincipal();
            
            if(WETHInThePool < additionalWETHRequired) {
                revert NotEnoughWethLiquidity(WETHInThePool, additionalWETHRequired);
            }

            uint256 shareOfWethToRemove = additionalWETHRequired.divPrecisely(WETHInThePool) + 1;
            _removePartialLiquidity(shareOfWethToRemove);
        }

        // burn remaining OETHb
        _burnOETHbOnTheContract();
        _withdraw(_recipient, _amount);
    }

    /**
     * @notice Withdraw all supported assets from platform and
     * sends to the OToken's Vault.
     */
    function withdrawAll()
        external
        override
        onlyVault
        nonReentrant
    {
        _removeAllLiquidity();

        uint256 balance = IERC20(WETH).balanceOf(address(this));
        if (balance > 0) {
            _withdraw(vaultAddress, balance);
        }
        // burn remaining OETHb
        _burnOETHbOnTheContract();
    }

    function _withdraw(
        address _recipient,
        uint256 _amount
    ) internal {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");

        IERC20(WETH).safeTransfer(_recipient, _amount);
        emit Withdrawal(WETH, address(0), _amount);
    }


    /**
     * @dev Collect the AERO token from the gauge 
     */
    function _collectRewardTokens() internal override {
        clGauge.getReward(tokenId);
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
     * @dev Internal method to respond to the addition of new asset / pTokens
            We need to give the Aerodrome pool approval to transfer the
            asset.
     * @param _asset Address of the asset to approve
     * @param _pToken Address of the pToken
     */
    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {
        IERC20(_asset).safeApprove(address(positionManager), type(uint256).max);
        IERC20(_asset).safeApprove(address(swapRouter), type(uint256).max);
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
        IERC20(WETH).safeApprove(address(positionManager), type(uint256).max);
        IERC20(OETHb).safeApprove(address(positionManager), type(uint256).max);
        IERC20(WETH).safeApprove(address(swapRouter), type(uint256).max);
        IERC20(OETHb).safeApprove(address(swapRouter), type(uint256).max);
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
        // we could in theory deposit to the strategy and forget to call rebalance in the same
        // governance transaction batch. In that case the WETH that is on the strategy contract
        // also needs to be accounted for. 
        uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
        // just paranoia check, in case there is OETHb in the strategy that for some reason hasn't
        // gotten burned yet.
        uint256 oethbBalance = IERC20(OETHb).balanceOf(address(this));
        return underlyingAssets + wethBalance + oethbBalance;
    }

    /**
     * @dev Returns the balance of both tokens in a given position (excluding fees)
     * @return amountWETH Amount of WETH in position
     * @return amountOETHb Amount of OETHb in position
     */
    function getPositionPrincipal()
        public
        view
        returns (uint256 amountWETH, uint256 amountOETHb)
    {
        if (tokenId == 0) {
            return (0,0);
        }

        uint160 sqrtRatioX96 = getPoolX96Price();
        (amountWETH, amountOETHb) = helper.principal(
            positionManager,
            tokenId,
            sqrtRatioX96
        );
    }

    function getPoolX96Price()
        public
        view
        returns (uint160 sqrtRatioX96) {
            (sqrtRatioX96, , , , ,) = clPool.slot0();
        }

    function _getLiquidity() 
        internal 
        view
        returns (
            uint128 liquidity
        ) {

        if (tokenId == 0) {
            revert("No LP position");
        }

        (,,,,,,,liquidity,,,,) = positionManager.positions(tokenId);
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
