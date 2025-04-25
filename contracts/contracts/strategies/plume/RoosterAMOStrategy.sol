// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Rooster AMO strategy
 * @author Origin Protocol Inc
 */
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
//import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../../utils/StableMath.sol";

//import { INonfungiblePositionManager } from "../../interfaces/aerodrome/INonfungiblePositionManager.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IMaverickV2Pool } from "../../interfaces/plume/IMaverickV2Pool.sol";
import { IMaverickV2LiquidityManager } from "../../interfaces/plume/IMaverickV2LiquidityManager.sol";
import { IMaverickV2PoolLens } from "../../interfaces/plume/IMaverickV2PoolLens.sol";
// importing custom version of rooster TickMath because of dependency collision. Maverick uses
// a newer OpenZepplin Math library with functionality that is not present in 4.4.2 (the one we use)
import { TickMath } from "../../../lib/rooster/v2-common/libraries/TickMath.sol";

import "hardhat/console.sol";

contract RoosterAMOStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    //using SafeCast for uint256;

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
        emit Deposit(_asset, address(0), _amount);

        // if the pool price is not within the expected interval leave the WETH on the contract
        // as to not break the mints
        // (bool _isExpectedRange, ) = _checkForExpectedPoolPrice(false);
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

        // /**
        //  * First check we are in expected tick range
        //  *
        //  * We revert even though price being equal to the lower tick would still
        //  * count being within lower tick for the purpose of Sugar.estimateAmount calls
        //  */
        // if (
        //     _currentPrice <= sqrtRatioX96TickLower ||
        //     _currentPrice >= sqrtRatioX96TickHigher
        // ) {
        //     if (throwException) {
        //         revert OutsideExpectedTickRange(getCurrentTradingTick());
        //     }
        //     return (false, 0);
        // }

        // // 18 decimal number expressed WETH tick share
        // _wethSharePct = _getWethShare(_currentPrice);

        // if (
        //     _wethSharePct < allowedWethShareStart ||
        //     _wethSharePct > allowedWethShareEnd
        // ) {
        //     if (throwException) {
        //         revert PoolRebalanceOutOfBounds(
        //             _wethSharePct,
        //             allowedWethShareStart,
        //             allowedWethShareEnd
        //         );
        //     }
        //     return (false, _wethSharePct);
        // }

        // return (true, _wethSharePct);
    }

    /**
     * @notice Returns the current pool price in square root
     * @return _sqrtRatioX96 Pool price
     */
    function getPoolSqrtPrice() public view returns (uint256) {
        return poolLens.getPoolSqrtPrice(mPool);
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
}
