// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IStrategy } from "../../interfaces/IStrategy.sol";
import { IVault } from "../../interfaces/IVault.sol";

import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import { INonfungiblePositionManager } from "../../interfaces/uniswap/v3/INonfungiblePositionManager.sol";
import { IUniswapV3Helper } from "../../interfaces/uniswap/v3/IUniswapV3Helper.sol";
import { IUniswapV3Strategy } from "../../interfaces/IUniswapV3Strategy.sol";
import { ISwapRouter } from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

abstract contract UniswapV3StrategyStorage is InitializableAbstractStrategy {
    event OperatorChanged(address _address);
    event ReserveStrategyChanged(address asset, address reserveStrategy);
    event MinDepositThresholdChanged(
        address asset,
        uint256 minDepositThreshold
    );
    event RebalancePauseStatusChanged(bool paused);
    event SwapsPauseStatusChanged(bool paused);
    event SwapPriceThresholdChanged(
        int24 minTick,
        uint160 minSwapPriceX96,
        int24 maxTick,
        uint160 maxSwapPriceX96
    );
    event MaxSwapSlippageChanged(uint24 maxSlippage);
    event TokenPriceLimitChanged(
        int24 minTick,
        uint160 minPriceLimitX96,
        int24 maxTick,
        uint160 maxPriceLimitX96
    );
    event AssetSwappedForRebalancing(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
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
    event UniswapV3PositionClosed(
        uint256 indexed tokenId,
        uint256 amount0Received,
        uint256 amount1Received
    );
    event UniswapV3FeeCollected(
        uint256 indexed tokenId,
        uint256 amount0,
        uint256 amount1
    );

    // Represents both tokens supported by the strategy
    struct PoolToken {
        // True if asset is either token0 or token1
        bool isSupported;
        // When the funds are not deployed in Uniswap V3 Pool, they will
        // be deposited to these reserve strategies
        address reserveStrategy;
        // Deposits to reserve strategy when contract balance exceeds this amount
        uint256 minDepositThreshold;
    }

    // Represents a position minted by UniswapV3Strategy contract
    struct Position {
        uint256 tokenId; // ERC721 token Id of the minted position
        uint128 liquidity; // Amount of liquidity deployed
        int24 lowerTick; // Lower tick index
        int24 upperTick; // Upper tick index
        bool exists; // True, if position is minted
        // The following two fields are redundant but since we use these
        // two quite a lot, think it might be cheaper to store it than
        // compute it every time?
        uint160 sqrtRatioAX96;
        uint160 sqrtRatioBX96;
    }

    // Set to the proxy address when initialized
    IUniswapV3Strategy public _self;

    // The address that can manage the positions on Uniswap V3
    address public operatorAddr;
    address public token0; // Token0 of Uniswap V3 Pool
    address public token1; // Token1 of Uniswap V3 Pool

    uint24 public poolFee; // Uniswap V3 Pool Fee
    uint24 public maxSwapSlippage = 100; // 1%; Reverts if swap slippage is higher than this
    bool public swapsPaused = false; // True if Swaps are paused
    bool public rebalancePaused = false; // True if Swaps are paused

    uint256 public maxTVL; // In USD, 18 decimals

    // An upper and lower bound of swap price limits
    uint160 public minSwapPriceX96;
    uint160 public maxSwapPriceX96;

    // Uses these params when checking the values of the tokens
    // moved in and out of the reserve strategies
    uint160 public minPriceLimitX96;
    uint160 public maxPriceLimitX96;

    // Token ID of active Position on the pool. zero, if there are no active LP position
    uint256 public activeTokenId;

    // Uniswap V3's Pool
    IUniswapV3Pool public pool;

    // Uniswap V3's PositionManager
    INonfungiblePositionManager public positionManager;

    // A deployed contract that's used to call methods of Uniswap V3's libraries despite version mismatch
    IUniswapV3Helper internal helper;

    // Uniswap Swap Router
    ISwapRouter internal swapRouter;

    // Contains data about both tokens
    mapping(address => PoolToken) public poolTokens;

    // A lookup table to find token IDs of position using f(lowerTick, upperTick)
    mapping(int48 => uint256) internal ticksToTokenId;

    // Maps tokenIDs to their Position object
    mapping(uint256 => Position) public tokenIdToPosition;

    // keccak256("OUSD.UniswapV3Strategy.LiquidityManager.impl")
    bytes32 constant liquidityManagerImplPosition =
        0xec676d52175f7cbb4e4ea392c6b70f8946575021aad20479602b98adc56ad62d;

    // Future-proofing
    uint256[100] private __gap;

    /***************************************
            Modifiers
    ****************************************/

    /**
     * @dev Ensures that the caller is Governor or Strategist.
     */
    modifier onlyGovernorOrStrategist() {
        require(
            msg.sender == IVault(vaultAddress).strategistAddr() ||
                msg.sender == governor(),
            "Caller is not the Strategist or Governor"
        );
        _;
    }

    /**
     * @dev Ensures that the caller is Governor, Strategist or Operator.
     */
    modifier onlyGovernorOrStrategistOrOperator() {
        require(
            msg.sender == operatorAddr ||
                msg.sender == IVault(vaultAddress).strategistAddr() ||
                msg.sender == governor(),
            "Caller is not the Operator, Strategist or Governor"
        );
        _;
    }

    /**
     * @dev Ensures that the caller is Governor, Strategist or Operator.
     */
    modifier onlyGovernorOrStrategistOrOperatorOrVault() {
        require(
            msg.sender == operatorAddr ||
                msg.sender == IVault(vaultAddress).strategistAddr() ||
                msg.sender == governor(),
            "Caller is not the Operator, Strategist, Governor or Vault"
        );
        _;
    }

    /**
     * @dev Ensures that the asset address is either token0 or token1.
     */
    modifier onlyPoolTokens(address addr) {
        require(addr == token0 || addr == token1, "Unsupported asset");
        _;
    }

    /**
     * @dev Ensures that the caller is the proxy.
     */
    modifier onlySelf() {
        require(msg.sender == address(_self), "Not self");
        _;
    }
}
