// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Aerodrome AMO strategy
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { ISugarHelper } from "../interfaces/aerodrome/ISugarHelper.sol";
import { INonfungiblePositionManager } from "../interfaces/aerodrome/INonfungiblePositionManager.sol";
import { ISwapRouter } from "../interfaces/aerodrome/ISwapRouter.sol";
import { ICLFactory } from "../interfaces/aerodrome/ICLFactory.sol";
import { ICLPool } from "../interfaces/aerodrome/ICLPool.sol";


contract AerodromeAMOStrategy is InitializableAbstractStrategy {
    using SafeERC20 for IERC20;

    /***************************************
            Storage slot members
    ****************************************/

    /// @notice tokenId of the liquidity position
    uint256 public tokenId;
    /// @notice amount of liquidity deployed
    uint128 public liquidity;
    /// @notice TODO is this redundant to liquidity???
    uint256 public netValue;
    /// @notice the swapRouter for performing swaps
    ISwapRouter public swapRouter;
    /// @notice factory for pool creation
    ICLFactory public clFactory;
    /// @notice the pool used
    ICLPool public clPool;
    /// @notice the liquidity position
    INonfungiblePositionManager public positionManager;
    /// @notice helper contract for liquidity and ticker math
    ISugarHelper public helper;
    /// @notice sqrtRatioX96Tick0
    uint160 public sqrtRatioX96Tick0;
    /// @notice sqrtRatioX96Tick1
    uint160 public sqrtRatioX96Tick1;
    /// @dev reserved for inheritance
    int256[50] private __reserved;

    /***************************************
          Constants, structs and events
    ****************************************/

    /// @notice The address of the Wrapped ETH (WETH) token contract
    address public immutable WETH;
    /// @notice The address of the OETHb token contract
    address public immutable OETHb;
    /// @notice lower tick set to 0 representing the price of 1. Equation 1.0001^0 = 1
    int24 public immutable lowerTick;
    /// @notice lower tick set to 1 representing the price of 1.0001. Equation 1.0001^1 = 1.0001
    int24 public immutable upperTick;
    /// @notice tick spacing of the pool (set to 1)
    int24 public immutable tickSpacing;

    // Represents a position minted by UniswapV3Strategy contract
    struct Position {
        // The following two fields are redundant but since we use these
        // two quite a lot, think it might be cheaper to store it than
        // compute it every time?
        uint160 sqrtRatioAX96;
        uint160 sqrtRatioBX96;
        uint256 netValue; // Last recorded net value of the position
    }

    event UniswapV3LiquidityAdded(
        uint256 indexed tokenId,
        uint256 amount0Sent,
        uint256 amount1Sent,
        uint128 liquidityMinted
    );
    event UniswapV3LiquidityRemoved(
        uint256 indexed tokenId,
        uint256 amount0Received,
        uint256 amount1Received,
        uint128 liquidityBurned
    );
    event UniswapV3PositionMinted(
        uint256 indexed tokenId,
        int24 lowerTick,
        int24 upperTick
    );

    /// @param _stratConfig st
    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _OETHbAddress Address of the Erc20 OETHb Token contract
    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _wethAddress,
        address _OETHbAddress
    ) InitializableAbstractStrategy(_stratConfig)
    {
        WETH = _wethAddress;
        OETHb = _OETHbAddress;

        lowerTick = 0;
        upperTick = 1;
        tickSpacing = 1;
    }

    /**
     * @notice initialize function, to set up initial internal state
     * @param _rewardTokenAddresses Address of reward token for platform
     * @param _assets Addresses of initial supported assets
     * @param _pTokens Platform Token corresponding addresses
     * @param _swapRouter Address of the Aerodrome Universal Swap Router
     * @param _nonfungiblePositionManager Address of position manager to add/remove
     *        the liquidity
     * @param _clFactory Address of the concentrated liquidity factory
     */
    function initialize(
        address[] memory _rewardTokenAddresses,
        address[] memory _assets,
        address[] memory _pTokens,
        address _swapRouter,
        address _nonfungiblePositionManager,
        address _clFactory,
        address _sugarHelper
    ) external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );

        swapRouter = ISwapRouter(_swapRouter);
        positionManager = INonfungiblePositionManager(
            _nonfungiblePositionManager
        );
        clFactory = ICLFactory(_clFactory);
        helper = ISugarHelper(_sugarHelper);
        sqrtRatioX96Tick0 = helper.getSqrtRatioAtTick(0);
        sqrtRatioX96Tick1 = helper.getSqrtRatioAtTick(1);
    }

    /**
     * @notice Deposit an amount of assets into the platform
     * @param _asset               Address for the asset
     * @param _amount              Units of asset to deposit
     */
    function deposit(address _asset, uint256 _amount) external virtual override {

    }

    /**
     * @notice Deposit all supported assets in this strategy contract to the platform
     */
    function depositAll() external virtual override {

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
    ) external virtual override {

    }

    /**
     * @notice Withdraw all supported assets from platform and
     * sends to the OToken's Vault.
     */
    function withdrawAll() external virtual override {

    }


    /**
     * @dev Default TODO
     */
    function _collectRewardTokens() internal override {
        // TODO do other stuff
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
     * @dev Approve the spending of all assets by their corresponding aToken,
     *      if for some reason is it necessary.
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
        // TODO verify
        return netValue;
    }

    /**
     * @notice Returns the accumulated fees from the active position
     * @return amount0 Amount of token0 ready to be collected as fee
     * @return amount1 Amount of token1 ready to be collected as fee
     */
    function getPendingFees()
        external
        view
        returns (uint256 amount0, uint256 amount1)
    {

        (amount0, amount1) = helper.fees(
            positionManager,
            tokenId
        );
    }

    /**
     * @dev Returns the balance of both tokens in a given position (excluding fees)
     * @return amount0 Amount of token0 in position
     * @return amount1 Amount of token1 in position
     */
    function getPositionPrincipal()
        internal
        view
        returns (uint256 amount0, uint256 amount1)
    {
        (uint160 sqrtRatioX96, , , , ,) = clPool.slot0();
        (amount0, amount1) = helper.principal(
            positionManager,
            tokenId,
            sqrtRatioX96
        );
    }

    /**
     * @dev Returns the fees in a given position
     * TODO: test this, should return 0 since we don't earn fees
     * @return amount0 Amount of token0 in position
     * @return amount1 Amount of token1 in position
     */
    function getPositionFees()
        internal
        view
        returns (uint256 amount0, uint256 amount1)
    {
        (uint160 sqrtRatioX96, , , , ,) = clPool.slot0();
        (amount0, amount1) = helper.fees(
            positionManager,
            tokenId
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
     * @notice Mints a new position on the pool and provides liquidity to it
     *
     * @param _desiredAmount0 Desired amount of token0 to provide liquidity
     * @param _desiredAmount1 Desired amount of token1 to provide liquidity
     * @param _minAmount0 Min amount of token0 to deposit
     * @param _minAmount1 Min amount of token1 to deposit
     */
    function _mintPosition(
        uint256 _desiredAmount0,
        uint256 _desiredAmount1,
        uint256 _minAmount0,
        uint256 _minAmount1,
        int24 _lowerTick,
        int24 _upperTick
    )
        internal
    {
        INonfungiblePositionManager.MintParams
            memory params = INonfungiblePositionManager.MintParams({
                // TODO: we need to figure which token is smaller when it comes to addresses: 
                // https://github.com/velodrome-finance/slipstream/blob/87e4aae8143a2f3a800b8e1ef8c58d9b807caf4e/contracts/core/CLFactory.sol#L73

                token0: WETH,
                token1: OETHb,
                tickSpacing: tickSpacing,
                tickLower: _lowerTick,
                tickUpper: _upperTick,
                amount0Desired: _desiredAmount0,
                amount1Desired: _desiredAmount1,
                amount0Min: _minAmount0,
                amount1Min: _minAmount1,
                recipient: address(this),
                deadline: block.timestamp,
                /* Sets the initial price to 1 meaning we deposit only OETHb into the pool
                 * after that we swap 20% of it to WETH and burn the resulting OETHb
                 */ 
                sqrtPriceX96: sqrtRatioX96Tick0
            });

        (uint256 mintedTokenId, uint128 mintedLiquidity, uint256 amount0, uint256 amount1) = positionManager.mint(params);

        tokenId = mintedTokenId;
        liquidity = mintedLiquidity;
        netValue = amount0 + amount1;
        // TODO fetch the pool address

        //emit UniswapV3PositionMinted(mintedTokenId, lowerTick, upperTick);
        //emit UniswapV3LiquidityAdded(mintedTokenId, amount0, amount1, liquidity);
    }

    /**
     * @dev Swaps one token for other and then provides liquidity to pools.
     *
     * @param _desiredAmount0 Minimum amount of token0 needed
     * @param _desiredAmount1 Minimum amount of token1 needed
     * @param _swapAmountIn Amount of tokens to swap
     * @param _swapMinAmountOut Minimum amount of other tokens expected
     * @param _sqrtPriceLimitX96 Max price limit for swap
     * @param _swapZeroForOne True if swapping from token0 to token1
     */
    // function _ensureAssetsBySwapping(
    //     uint256 _desiredAmount0,
    //     uint256 _desiredAmount1,
    //     uint256 _swapAmountIn,
    //     uint256 _swapMinAmountOut,
    //     uint160 _sqrtPriceLimitX96,
    //     bool _swapZeroForOne
    // ) internal {
    //     require(!swapsPaused, "Swaps are paused");

    //     uint256 token0Balance = IERC20(token0).balanceOf(address(this));
    //     uint256 token1Balance = IERC20(token1).balanceOf(address(this));

    //     uint256 token0Needed = _desiredAmount0 > token0Balance
    //         ? _desiredAmount0 - token0Balance
    //         : 0;
    //     uint256 token1Needed = _desiredAmount1 > token1Balance
    //         ? _desiredAmount1 - token1Balance
    //         : 0;

    //     if (_swapZeroForOne) {
    //         // Amount available in reserve strategies
    //         uint256 t1ReserveBal = reserveStrategy1.checkBalance(token1);

    //         // Only swap when asset isn't available in reserve as well
    //         require(token1Needed > 0, "No need for swap");
    //         require(
    //             token1Needed > t1ReserveBal,
    //             "Cannot swap when the asset is available in reserve"
    //         );
    //         // Additional amount of token0 required for swapping
    //         token0Needed += _swapAmountIn;
    //         // Subtract token1 that we will get from swapping
    //         token1Needed = (_swapMinAmountOut >= token1Needed)
    //             ? 0
    //             : (token1Needed - _swapMinAmountOut);
    //     } else {
    //         // Amount available in reserve strategies
    //         uint256 t0ReserveBal = reserveStrategy0.checkBalance(token0);

    //         // Only swap when asset isn't available in reserve as well
    //         require(token0Needed > 0, "No need for swap");
    //         require(
    //             token0Needed > t0ReserveBal,
    //             "Cannot swap when the asset is available in reserve"
    //         );
    //         // Additional amount of token1 required for swapping
    //         token1Needed += _swapAmountIn;
    //         // Subtract token0 that we will get from swapping
    //         token0Needed = (_swapMinAmountOut >= token0Needed)
    //             ? 0
    //             : (token0Needed - _swapMinAmountOut);
    //     }

    //     // Fund strategy from reserve strategies
    //     if (token0Needed > 0) {
    //         IVault(vaultAddress).withdrawFromUniswapV3Reserve(
    //             token0,
    //             token0Needed
    //         );
    //     }

    //     if (token1Needed > 0) {
    //         IVault(vaultAddress).withdrawFromUniswapV3Reserve(
    //             token1,
    //             token1Needed
    //         );
    //     }

    //     // Swap it
    //     uint256 amountReceived = swapRouter.exactInputSingle(
    //         ISwapRouter.ExactInputSingleParams({
    //             tokenIn: _swapZeroForOne ? token0 : token1,
    //             tokenOut: _swapZeroForOne ? token1 : token0,
    //             fee: poolFee,
    //             recipient: address(this),
    //             deadline: block.timestamp,
    //             amountIn: _swapAmountIn,
    //             amountOutMinimum: _swapMinAmountOut,
    //             sqrtPriceLimitX96: _sqrtPriceLimitX96
    //         })
    //     );

    //     emit AssetSwappedForRebalancing(
    //         _swapZeroForOne ? token0 : token1,
    //         _swapZeroForOne ? token1 : token0,
    //         _swapAmountIn,
    //         amountReceived
    //     );
    // }
}
