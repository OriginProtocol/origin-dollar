// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Rooster AMO strategy
 * @author Origin Protocol Inc
 */
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../../utils/StableMath.sol";

//import { INonfungiblePositionManager } from "../../interfaces/aerodrome/INonfungiblePositionManager.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IMaverickV2Pool } from "../../interfaces/plume/IMaverickV2Pool.sol";
import { IMaverickV2LiquidityManager } from "../../interfaces/plume/IMaverickV2LiquidityManager.sol";
import { IMaverickV2PoolLens } from "../../interfaces/plume/IMaverickV2PoolLens.sol";
import { IMaverickV2Position } from "../../interfaces/plume/IMaverickV2Position.sol";
// importing custom version of rooster TickMath because of dependency collision. Maverick uses
// a newer OpenZepplin Math library with functionality that is not present in 4.4.2 (the one we use)
import { TickMath } from "../../../lib/rooster/v2-common/libraries/TickMath.sol";
import { ONE } from "../../../lib/rooster/v2-common/libraries/Constants.sol";
import { Math as Math_v2 } from "../../../lib/rooster/v2-common/libraries/Math.sol";

import "hardhat/console.sol";

contract RoosterAMOStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    /************************************************
            Important (!) setup configuration
    *************************************************/

    /**
     * TODO: we need to donate to pool before doing any operations
     */

    /***************************************
            Storage slot members
    ****************************************/

    /// @notice NFT tokenId of the liquidity position
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
    /// @notice The address of the OETHp token contract
    address public immutable OETHp;
    // /// @notice lower tick set to -1 representing the price of 1.0001 of WETH for 1 OETHp.
    // int24 public immutable lowerTick;
    // /// @notice lower tick set to 0 representing the price of 1.0000 of WETH for 1 OETHp.
    // int24 public immutable upperTick;
    /// @notice tick spacing of the pool (set to 1)
    int24 public immutable tickSpacing;
    // /// @notice the swapRouter for performing swaps
    // ISwapRouter public immutable swapRouter;
    /// @notice the underlying AMO Maverick pool
    IMaverickV2Pool public immutable mPool;
    // /// @notice the gauge for the corresponding Slipstream pool (clPool)
    // /// @dev can become an immutable once the gauge is created on the base main-net
    // ICLGauge public immutable clGauge;
    /// @notice the Liquidity manager used to add liquidity to the mPool
    IMaverickV2LiquidityManager public immutable liquidityManager;
    /// @notice the Maverick V2 pool lens
    IMaverickV2PoolLens public immutable poolLens;
    /// @notice the Maverick V2 position
    IMaverickV2Position public immutable maverickPosition;
    /// @notice sqrtPriceTickLower
    /// @dev tick lower represents the lowest price of WETH priced in OETHp. Meaning the pool
    /// offers less than 1 OETHp for 1 WETH. In other terms to get 1 OETHp the swap needs to offer 1.0001 WETH
    /// this is where purchasing OETHp with WETH within the liquidity position is most expensive
    uint256 public immutable sqrtPriceTickLower;
    /// @notice sqrtPriceTickHigher
    /// @dev tick higher represents 1:1 price parity of WETH to OETHp
    uint256 public immutable sqrtPriceTickHigher;
    /// @notice The tick where the strategy deploys the liquidity to
    int32 public tickNumber;

    // /// @notice helper contract for liquidity and ticker math
    // ISugarHelper public immutable helper;

    /// @dev a threshold under which the contract no longer allows for the protocol to rebalance. Guarding
    ///      against a strategist / guardian being taken over and with multiple transactions draining the
    ///      protocol funds.
    uint256 public constant SOLVENCY_THRESHOLD = 0.998 ether;


    event PoolWethShareIntervalUpdated(
        uint256 allowedWethShareStart,
        uint256 allowedWethShareEnd
    );
    event LiquidityRemoved(
        uint256 withdrawLiquidityShare,
        uint256 removedWETHAmount,
        uint256 removedOETHbAmount,
        uint256 underlyingAssets
    );
    event PoolRebalanced(uint256 currentPoolWethShare);

    error OutsideExpectedTickRange(int32 currentTick); // 0xacdf6376
    error PoolRebalanceOutOfBounds(
        uint256 currentPoolWethShare,
        uint256 allowedWethShareStart,
        uint256 allowedWethShareEnd
    ); // 0x3681e8e0
    error NotEnoughWethForSwap(uint256 wethBalance, uint256 requiredWeth); // 0x989e5ca8
    error NotEnoughWethLiquidity(uint256 wethBalance, uint256 requiredWeth); // 0xa6737d87

    // /**
    //  * @dev Verifies that the caller is the Governor, or Strategist.
    //  */
    // modifier onlyGovernorOrStrategist() {
    //     require(
    //         msg.sender == IVault(vaultAddress).strategistAddr() ||
    //             msg.sender == governor(),
    //         "Not the Governor or Strategist"
    //     );
    //     _;
    // }


    /// @notice the constructor
    /// @dev This contract is intended to be used as a proxy. To prevent the
    ///      potential confusion of having a functional implementation contract
    ///      the constructor has the `initializer` modifier. This way the
    ///      `initialize` function can not be called on the implementation contract.
    ///      For the same reason the implementation contract also has the governor
    ///      set to a zero address.
    /// @param _stratConfig the basic strategy configuration
    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _oethpAddress Address of the Erc20 OETHp Token contract
    /// @param _liquidityManager Address of liquidity manager to add
    ///         the liquidity
    /// @param _mPool Address of the Aerodrome concentrated liquidity pool
    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _wethAddress,
        address _oethpAddress,
        address _liquidityManager,
        address _poolLens,
        address _maverickPosition,
        address _mPool
    ) initializer InitializableAbstractStrategy(_stratConfig) {
        require(
            address(IMaverickV2Pool(_mPool).tokenA()) == _wethAddress,
            "Only WETH supported as tokenA"
        );
        require(
            address(IMaverickV2Pool(_mPool).tokenB()) == _oethpAddress,
            "Only OETHp supported as tokenB"
        );
        require(_liquidityManager != address(0),
            "LiquidityManager zero address not allowed"
        );
        require(_poolLens != address(0),
            "PoolLens zero address not allowed"
        );
        require(_maverickPosition != address(0),
            "Position zero address not allowed"
        );

        uint256 _tickSpacing = IMaverickV2Pool(_mPool).tickSpacing();
        require(_tickSpacing == 1, "Unsupported tickSpacing");

        // tickSpacing == 1
        (sqrtPriceTickLower, sqrtPriceTickHigher) = TickMath.tickSqrtPrices(_tickSpacing, tickNumber);

        WETH = _wethAddress;
        OETHp = _oethpAddress;
        liquidityManager = IMaverickV2LiquidityManager(
            _liquidityManager
        );
        poolLens = IMaverickV2PoolLens(_poolLens);
        maverickPosition = IMaverickV2Position(_maverickPosition);
        mPool = IMaverickV2Pool(_mPool);

        require(address(mPool.tokenA()) == WETH, "WETH not TokanA");
        require(address(mPool.tokenB()) == OETHp, "OETHp not TokanB");

        tickNumber = -1;

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

    // function _isLpTokenStakedInGauge() internal view returns (bool) {
    //     require(tokenId != 0, "Missing NFT LP token");

    //     address owner = positionManager.ownerOf(tokenId);
    //     require(
    //         owner == address(clGauge) || owner == address(this),
    //         "Unexpected token owner"
    //     );
    //     return owner == address(clGauge);
    // }

    /***************************************
               Strategy overrides 
    ****************************************/

    /**
     * @notice todo...
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
     * @notice todo...
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 _wethBalance = IERC20(WETH).balanceOf(address(this));
        if (_wethBalance > 1e12) {
            _deposit(WETH, _wethBalance);
        }
    }

    /**
     * @dev todo...
     * @param _asset Address of the asset to deposit
     * @param _amount Amount of assets to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal {
        require(_asset == WETH, "Unsupported asset");
        require(_amount > 0, "Must deposit something");
        require(tokenId > 0, "Initial position not minted");
        emit Deposit(_asset, address(0), _amount);

        // if the pool price is not within the expected interval leave the WETH on the contract
        // as to not break the mints
        (bool _isExpectedRange, ) = _checkForExpectedPoolPrice(false);
        // if (_isExpectedRange) {
        //     // deposit funds into the underlying pool
        //     _rebalance(0, false, 0);
        // }
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
    }

    /**
     * @notice Withdraw WETH and sends it to the Vault.
     */
    function withdrawAll() external override onlyVault nonReentrant {
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
        IERC20(WETH).approve(address(liquidityManager), type(uint256).max);
        IERC20(OETHp).approve(address(liquidityManager), type(uint256).max);
    }

    /**
     * @dev Perform a swap so that after the swap the tick has the desired WETH to OETHp token share.
     */
    function _swapToDesiredPosition(
        uint256 _amountToSwap,
        bool _swapWeth,
        uint256 _minTokenReceived
    ) internal {
        IERC20 _tokenToSwap = IERC20(_swapWeth ? WETH : OETHp);
        uint256 _balance = _tokenToSwap.balanceOf(address(this));

        if (_balance < _amountToSwap) {
            // This should never trigger since _ensureWETHBalance will already
            // throw an error if there is not enough WETH
            if (_swapWeth) {
                revert NotEnoughWethForSwap(_balance, _amountToSwap);
            }
            // if swapping OETHp
            uint256 mintForSwap = _amountToSwap - _balance;
            IVault(vaultAddress).mintForStrategy(mintForSwap);
        }

        if (_swapWeth) {
            IERC20(WETH).transfer(address(mPool), _amountToSwap);
        } else {
            IERC20(OETHp).transfer(address(mPool), _amountToSwap);
        }

        IMaverickV2Pool.SwapParams memory swapParams = IMaverickV2Pool.SwapParams({
            amount: _amountToSwap,
            tokenAIn: _swapWeth,
            exactOutput: false,
            tickLimit: tickNumber
        });

        // swaps without a callback as the assets are already sent to the pool
        (, uint256 amountOut) = mPool.swap(address(this), swapParams, bytes(""));

        // todo: custom error with exact amount
        require(amountOut < _minTokenReceived, "Not enough token received");

        /**
         * In the interest of each function in _rebalance to leave the contract state as
         * clean as possible the OETHp tokens here are burned. This decreases the
         * dependence where `_swapToDesiredPosition` function relies on later functions
         * (`addLiquidity`) to burn the OETHp. Reducing the risk of error introduction.
         */
        _burnOethOnTheContract();
    }

    /***************************************
              Liquidity management
    ****************************************/

    /**
     * @notice Donate initial liquidity to the pool that can not be withdrawn
     */
    function donateLiquidity() external onlyGovernor nonReentrant {
        (,,IMaverickV2Pool.AddLiquidityParams[] memory addParams) = _addLiquidity(1e18, 1e18);

        IVault(vaultAddress).mintForStrategy(1e18);
        liquidityManager.donateLiquidity(mPool, addParams[0]);
        // Burn remaining OETHp
        IVault(vaultAddress).burnForStrategy(IERC20(OETHp).balanceOf(address(this)));
    }

    /// @dev creates add liquidity view input params with default values. The `targetAmount` & `targetIsA` need to be
    ///      overridden
    function _createAddLiquidityParams() internal returns (IMaverickV2PoolLens.AddParamsViewInputs memory){
        int32[] memory ticks = new int32[](1);
        uint128[] memory relativeLiquidityAmounts = new uint128[](1);
        // add all liquidity into a single tick
        ticks[0] = tickNumber;
        // all liquidity into one tick
        relativeLiquidityAmounts[0] = 1e18;

        IMaverickV2PoolLens.AddParamsSpecification memory addSpec = IMaverickV2PoolLens.AddParamsSpecification({
            slippageFactorD18: 0.01e18,
            numberOfPriceBreaksPerSide: 0,
            targetAmount: 1e18, // is altered later
            targetIsA: false // can be altered later
        });

        return IMaverickV2PoolLens.AddParamsViewInputs({
            pool: mPool,
            kind: 0, // static kind
            ticks: ticks,
            relativeLiquidityAmounts: relativeLiquidityAmounts,
            addSpec: addSpec
        });
    }

    function _addLiquidity(uint256 maxWETH, uint256 maxOETHp)
        internal
        returns (
            bytes memory packedSqrtPriceBreaks,
            bytes[] memory packedArgs,
            IMaverickV2Pool.AddLiquidityParams[] memory addParams
        )
    {
        IMaverickV2Pool.TickState memory tickState = mPool.getTick(tickNumber);
        IMaverickV2PoolLens.AddParamsViewInputs memory params = _createAddLiquidityParams();

        // tick has no WETH liquidity
        if (tickState.reserveA == 0) {
            params.addSpec.targetAmount = maxOETHp;
            params.addSpec.targetIsA = false;
            (packedSqrtPriceBreaks, packedArgs,, addParams, ) = poolLens.getAddLiquidityParams(params);

        // tick has no OETHp liquidity
        } else if (tickState.reserveB == 0) {
            // we only need to check targetIsA = true
            params.addSpec.targetAmount = maxWETH;
            params.addSpec.targetIsA = true;
            (packedSqrtPriceBreaks, packedArgs,, addParams, ) = poolLens.getAddLiquidityParams(params);
        // tick has liquidity of both tokens
        } else {
            // we need to check both
            params.addSpec.targetAmount = maxWETH;
            params.addSpec.targetIsA = true;
            IMaverickV2PoolLens.TickDeltas[] memory tickDeltas;
            (packedSqrtPriceBreaks, packedArgs,, addParams, tickDeltas) = poolLens.getAddLiquidityParams(params);
            if (tickDeltas[0].deltaBOut > maxOETHp) {
                // we know the params didn't meet out max spec.  we are asking for more OETHp than we want to spend.  
                // do the call again with OETHp as the target.  
               params.addSpec.targetAmount = maxOETHp;
               params.addSpec.targetIsA = false;
               (packedSqrtPriceBreaks, packedArgs,, addParams, ) = poolLens.getAddLiquidityParams(params);
            }
        }

    }

    /**
     * @dev Check that the Rooster pool price is within the expected
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

        uint256 _currentPrice = getPoolSqrtPrice();

        /**
         * First check we are in expected tick range
         *
         * We revert even though price being equal to the lower tick would still
         * count being within lower tick for the purpose of Sugar.estimateAmount calls
         */
        if (
            _currentPrice <= sqrtPriceTickLower ||
            _currentPrice >= sqrtPriceTickHigher
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

    function _rebalance(
        uint256 _amountToSwap,
        bool _swapWeth,
        uint256 _minTokenReceived
    ) internal {
        /**
         * There will always be some throw-away donated liquidity in the pool facilitating the
         * possibility of swap when rebalancing
         */

        /**
         * When rebalance is called for the first time there is no strategy
         * liquidity in the pool yet. The liquidity removal is thus skipped.
         * Also execute this function when WETH is required for the swap.
         */
        if (_swapWeth && _amountToSwap > 0) {
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
     * @dev Decrease partial or all liquidity from the pool.
     * @param _liquidityToDecrease The amount of liquidity to remove expressed in 18 decimal point
     */
    function _removeLiquidity(uint256 _liquidityToDecrease)
        internal
        gaugeUnstakeAndRestake
    {
        require(_liquidityToDecrease > 0, "Must remove some liquidity");

        IMaverickV2Pool.RemoveLiquidityParams memory params = maverickPosition.getRemoveParams(tokenId, 0, _liquidityToDecrease);
        (uint256 _amountWeth, uint256 _amountOethp) = position.removeLiquidityToSender(tokenId, pool, params);

        _updateUnderlyingAssets();

        emit LiquidityRemoved(
            _liquidityToDecrease,
            _amountWeth,
            _amountOethp,
            underlyingAssets
        );

        _burnOethOnTheContract();
    }

    /// @dev TODO: how are fees / tokens collected???
    /// This function assumes there are no uncollected tokens in the clPool owned by the strategy contract.
    ///      For that reason any liquidity withdrawals must also collect the tokens.
    function _updateUnderlyingAssets() internal {
        if (tokenId == 0) {
            underlyingAssets = 0;
            emit UnderlyingAssetsUpdated(underlyingAssets);
            return;
        }

        /**
         * Our net value represent the smallest amount of tokens we are able to extract from the position
         * given our liquidity.
         *
         * The least amount of tokens extraditable from the position is where the active trading price is
         * at the ticker 0 meaning the pool is offering 1:1 trades between WETH & OETHp. At that moment the pool
         * consists completely of OETHp and no WETH.
         *
         * The more swaps from WETH -> OETHp happen on the pool the more the price starts to move towards the -1
         * ticker making OETHp (priced in WETH) more expensive.
         *
         * An additional note: when liquidity is 0 then the helper returns 0 for both token amounts. And the
         * function set underlying assets to 0.
         */
        (
            IMaverickV2Pool.TickState memory tickState,
            bool tickLtActive,
            bool tickGtActive
        ) = reservesInTickForGivenPrice(mPool, tickNumber, sqrtPriceTickHigher);

        uint256 _wethAmount = tickState.reserveA;
        uint256 _oethbAmount = tickState.reserveB;

        require(_wethAmount == 0, "Non zero wethAmount");
        underlyingAssets = _oethbAmount;
        emit UnderlyingAssetsUpdated(underlyingAssets);
    }

    /**
     * Burns any OETHp tokens remaining on the strategy contract
     */
    function _burnOethOnTheContract() internal {
        uint256 _oethpBalance = IERC20(OETHp).balanceOf(address(this));
        if (_oethpBalance > 1e12) {
            IVault(vaultAddress).burnForStrategy(_oethpBalance);
        }
    }

    function _getWethShare(uint256 _currentPrice)
        internal
        view
        returns (uint256)
    {
        (
            IMaverickV2Pool.TickState memory tickState,
            bool tickLtActive,
            bool tickGtActive
        ) = reservesInTickForGivenPrice(mPool, tickNumber, _currentPrice);

        console.log("Tick info");
        console.log(tickLtActive);
        console.log(tickGtActive);

        uint256 wethReserve = tickState.reserveA;
        uint256 oethpReserve = tickState.reserveB;

        console.log("Tick reserves");
        console.log(wethReserve);
        console.log(oethpReserve);

        // TODO: how to handle when weth is 0 or a low number?
        // approach 1: work off of square root prices as the distribution
        //             of liquidity between them is linear?
        // approach 2: the _currentPrice shouldn't be 1-2% close to 
        //             sqrtPriceTickLower or sqrtPriceTickHigher
        uint256 normalizationFactor = wethReserve / 1e18;
        // 18 decimal number expressed weth tick share
        return
            wethReserve
            .mulTruncate(normalizationFactor)
            .divPrecisely(
                wethReserve + oethpReserve
            );
    }

    /**
     * @notice Returns the current pool price in square root
     * @return _sqrtRatioX96 Pool price
     */
    function getPoolSqrtPrice() public view returns (uint256) {
        return poolLens.getPoolSqrtPrice(mPool);
    }

    /**
     * @notice Returns the current active trading tick of the underlying pool
     * @return _currentTick Current pool trading tick
     */
    function getCurrentTradingTick() public view returns (int32 _currentTick) {
        _currentTick = mPool.getState().activeTick;
    }

    /**
     * @notice Mint the initial NFT position
     */
    function mintInitialPosition() external onlyGovernor nonReentrant {
        (bytes memory packedSqrtPriceBreaks, bytes[] memory packedArgs,) = _addLiquidity(1e18, 1e18);
        IVault(vaultAddress).mintForStrategy(1e18);
        (,,, uint256 _tokenId) = liquidityManager.mintPositionNftToSender(mPool, packedSqrtPriceBreaks, packedArgs);
        // Burn remaining OETHp
        IVault(vaultAddress).burnForStrategy(IERC20(OETHp).balanceOf(address(this)));

        // Store the tokenId
        tokenId = _tokenId;
    }

    /**
     * @dev Returns the balance of both tokens in a given position (TODO does it include fees?)
     * @return _amountWeth Amount of WETH in position
     * @return _amountOethp Amount of OETHp in position
     */
    function getPositionPrincipal()
        public
        view
        returns (uint256 _amountWeth, uint256 _amountOethb)
    {
        if (tokenId == 0) {
            return (0, 0);
        }

        (,_amountWeth, _amountOethb,,,,) = maverickPosition.tokenIdPositionInformation(tokenId, 0);
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
        uint256 _totalOethpSupply = IERC20(OETHp).totalSupply();

        if (
            _totalVaultValue.divPrecisely(_totalOethpSupply) <
            SOLVENCY_THRESHOLD
        ) {
            revert("Protocol insolvent");
        }
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

        return 0;
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
          Maverick liquidity utilities
    ****************************************/

    /**
     * @notice Calculates deltaA = liquidity * (sqrt(upper) - sqrt(lower))
     *  Calculates deltaB = liquidity / sqrt(lower) - liquidity / sqrt(upper),
     *  i.e. liquidity * (sqrt(upper) - sqrt(lower)) / (sqrt(upper) * sqrt(lower))
     */
    function reservesInTickForGivenPrice(
        IMaverickV2Pool pool,
        int32 tick,
        uint256 newSqrtPrice
    ) internal view returns (IMaverickV2Pool.TickState memory tickState, bool tickLtActive, bool tickGtActive) {
        tickState = pool.getTick(tick);
        (uint256 lowerSqrtPrice, uint256 upperSqrtPrice) = TickMath.tickSqrtPrices(pool.tickSpacing(), tick);

        tickGtActive = newSqrtPrice < lowerSqrtPrice;
        tickLtActive = newSqrtPrice >= upperSqrtPrice;

        uint256 liquidity = TickMath.getTickL(tickState.reserveA, tickState.reserveB, lowerSqrtPrice, upperSqrtPrice);

        if (liquidity == 0) {
            (tickState.reserveA, tickState.reserveB) = (0, 0);
        } else {
            uint256 lowerEdge = Math_v2.max(lowerSqrtPrice, newSqrtPrice);

            tickState.reserveA = Math_v2
                .mulCeil(liquidity, Math_v2.clip(Math_v2.min(upperSqrtPrice, newSqrtPrice), lowerSqrtPrice))
                .toUint128();
            tickState.reserveB = Math_v2
                .mulDivCeil(liquidity, ONE * Math_v2.clip(upperSqrtPrice, lowerEdge), upperSqrtPrice * lowerEdge)
                .toUint128();
        }
    }
}
