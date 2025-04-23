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
    // /// @notice lower tick set to -1 representing the price of 1.0001 of WETH for 1 OETHb.
    // int24 public immutable lowerTick;
    // /// @notice lower tick set to 0 representing the price of 1.0000 of WETH for 1 OETHb.
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

    // /// @notice helper contract for liquidity and ticker math
    // ISugarHelper public immutable helper;

    /// @dev a threshold under which the contract no longer allows for the protocol to rebalance. Guarding
    ///      against a strategist / guardian being taken over and with multiple transactions draining the
    ///      protocol funds.
    uint256 public constant SOLVENCY_THRESHOLD = 0.998 ether;

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
    /// @param _oethpAddress Address of the Erc20 OETHb Token contract
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
            "Only OETHb supported as tokenB"
        );
        require(_liquidityManager != address(0),
            "LiquidityManager zero address not allowed"
        );
        require(_poolLens != address(0),
            "PoolLens zero address not allowed"
        );

        uint256 _tickSpacing = IMaverickV2Pool(_mPool).tickSpacing();
        // when we generalize AMO we might support other tick spacings
        // require(_tickSpacing == 15, "Unsupported tickSpacing");

        WETH = _wethAddress;
        OETHp = _oethpAddress;
        liquidityManager = IMaverickV2LiquidityManager(
            _liquidityManager
        );
        poolLens = IMaverickV2PoolLens(_poolLens);
        mPool = IMaverickV2Pool(_mPool);

        require(address(mPool.tokenA()) == WETH, "WETH not TokanA");
        require(address(mPool.tokenB()) == OETHp, "OETHp not TokanB");

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
     * @notice Donate initial liquidity to the pool that can not be withdrawn
     */
    function donateLiquidity() external onlyGovernor nonReentrant {
        int32[] memory ticks = new int32[](1);
        uint128[] memory relativeLiquidityAmounts = new uint128[](1);
        ticks[0] = 0;
        // all liquidity into one tick
        relativeLiquidityAmounts[0] = 1e18;

        uint256 maxAmountA = 1e18;
        uint256 slippageFactor = 0.01e18;
        IMaverickV2PoolLens.AddParamsSpecification memory addSpec = IMaverickV2PoolLens.AddParamsSpecification({
            slippageFactorD18: slippageFactor,
            numberOfPriceBreaksPerSide: 0,
            targetAmount: maxAmountA,
            targetIsA: true
        });

        int32 activeTick = mPool.getState().activeTick;
        console.log("activeTick");
        console.log(activeTick == 0); // true

        // see documentation: https://docs.mav.xyz/technical-reference/maverick-v2/v2-contracts/maverick-v2-supplemental-contracts/maverickv2poollens#getaddliquidityparams
        (,,,IMaverickV2Pool.AddLiquidityParams[] memory addParams, ) = poolLens.getAddLiquidityParams(IMaverickV2PoolLens.AddParamsViewInputs({
            pool: mPool,
            kind: 0, // static kind
            ticks: ticks,
            relativeLiquidityAmounts: relativeLiquidityAmounts,
            addSpec: addSpec
        }));

        console.log("addParams.length");
        console.log(addParams.length);
        liquidityManager.donateLiquidity(mPool, addParams[0]);
    }

    /**
     * @notice Mint the initial NFT position
     */
    function mintInitialPosition() external onlyGovernor nonReentrant {
        require(tokenId == 0, "NFT already minted");

        console.log("POol tick spacing");
        console.log(mPool.tickSpacing());
        (uint256 sqrtLowerTickPrice, uint256 sqrtUpperTickPrice) = TickMath.tickSqrtPrices(
            mPool.tickSpacing(), // 30
            -1 // active tick upon pool deployment
        );
        // sqrt price is price of B in terms of A
        (uint256 sqrtPrice, uint256 liquidity) = TickMath.getTickSqrtPriceAndL(
            200, // reserveA - WETH
            1000, // reserveB - OETHb
            sqrtLowerTickPrice,
            sqrtUpperTickPrice
        );

        console.log("Square root prices tick 0");
        console.log(sqrtLowerTickPrice);
        console.log(sqrtUpperTickPrice);
        console.log(sqrtPrice);
        console.log(liquidity);
        IVault(vaultAddress).mintForStrategy(1e18 * 2);
        console.log("WETH & OETHp balances");
        console.log(IERC20(WETH).balanceOf(address(this)));
        console.log(IERC20(OETHp).balanceOf(address(this)));

        int32[] memory ticks = new int32[](1);
        uint128[] memory relativeLiquidityAmounts = new uint128[](1);
        ticks[0] = -1;
        // all liquidity into one tick
        relativeLiquidityAmounts[0] = 1e18;

        uint256 maxAmountA = 1e18;
        // see documentation: https://docs.mav.xyz/technical-reference/maverick-v2/v2-contracts/maverick-v2-supplemental-contracts/interfaces/imaverickv2poollens#addparamsspecification
        IMaverickV2PoolLens.AddParamsSpecification memory addSpec = IMaverickV2PoolLens.AddParamsSpecification({
            slippageFactorD18: 0.01e18,
            numberOfPriceBreaksPerSide: 0,
            targetAmount: maxAmountA,
            targetIsA: false
        });

        int32 activeTick = mPool.getState().activeTick;
        console.log("activeTick");
        console.log(activeTick == -1); // true

        // see documentation: https://docs.mav.xyz/technical-reference/maverick-v2/v2-contracts/maverick-v2-supplemental-contracts/maverickv2poollens#getaddliquidityparams
        (bytes memory packedSqrtPriceBreaks, bytes[] memory packedArgs, , , ) = poolLens.getAddLiquidityParams(IMaverickV2PoolLens.AddParamsViewInputs({
            pool: mPool,
            kind: 0, // static kind
            ticks: ticks,
            relativeLiquidityAmounts: relativeLiquidityAmounts,
            addSpec: addSpec
        }));
        console.log("getAddLiquidityParams called");

        (uint256 amountA, uint256 amountB, , uint256 _tokenId) = liquidityManager.mintPositionNftToSender(mPool, packedSqrtPriceBreaks, packedArgs);
        // Store the tokenId
        tokenId = _tokenId;
    }

    /***************************************
                Periphery utils
    ****************************************/

    // todo periphery

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
