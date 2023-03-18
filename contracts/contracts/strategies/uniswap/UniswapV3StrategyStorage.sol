// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IStrategy } from "../../interfaces/IStrategy.sol";
import { IVault } from "../../interfaces/IVault.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import { INonfungiblePositionManager } from "../../interfaces/uniswap/v3/INonfungiblePositionManager.sol";
import { IUniswapV3Helper } from "../../interfaces/uniswap/v3/IUniswapV3Helper.sol";
import { IUniswapV3Strategy } from "../../interfaces/IUniswapV3Strategy.sol";
import { IVaultValueChecker } from "../../interfaces/IVaultValueChecker.sol";
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
    event RebalancePriceThresholdChanged(int24 minTick, int24 maxTick);
    event MaxTVLChanged(uint256 amountIn);
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
    event SwapPriceThresholdChanged(
        int24 minTick,
        uint160 minSwapPriceX96,
        int24 maxTick,
        uint160 maxSwapPriceX96
    );

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

    // When the funds are not deployed in Uniswap V3 Pool, they will
    // be deposited to these reserve strategies
    IStrategy public reserveStrategy0; // Reserve strategy for token0
    IStrategy public reserveStrategy1; // Reserve strategy for token1

    // Deposits to reserve strategy when contract balance exceeds this amount
    uint256 public minDepositThreshold0;
    uint256 public minDepositThreshold1;

    uint24 public poolFee; // Uniswap V3 Pool Fee
    bool public swapsPaused = false; // True if Swaps are paused
    bool public rebalancePaused = false; // True if Swaps are paused

    uint256 public maxTVL; // In USD, 18 decimals

    // An upper and lower bound of rebalancing price limits
    int24 public minRebalanceTick;
    int24 public maxRebalanceTick;

    // An upper and lower bound of swap price limits
    uint160 public minSwapPriceX96;
    uint160 public maxSwapPriceX96;

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

    // VaultValueChecker
    IVaultValueChecker public vaultValueChecker;

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
     * @dev Ensures that the asset address is either token0 or token1.
     */
    modifier onlyPoolTokens(address addr) {
        require(addr == token0 || addr == token1, "Unsupported asset");
        _;
    }

    /***************************************
            Commom functions
    ****************************************/
    /**
     * Deposits back strategy token balances back to the reserve strategies
     */
    function _depositAll() internal {
        uint256 token0Bal = IERC20(token0).balanceOf(address(this));
        uint256 token1Bal = IERC20(token1).balanceOf(address(this));
        IVault vault = IVault(vaultAddress);

        if (
            token0Bal > 0 &&
            (minDepositThreshold0 == 0 || token0Bal >= minDepositThreshold0)
        ) {
            vault.depositToUniswapV3Reserve(token0, token0Bal);
        }
        if (
            token1Bal > 0 &&
            (minDepositThreshold1 == 0 || token1Bal >= minDepositThreshold1)
        ) {
            vault.depositToUniswapV3Reserve(token1, token1Bal);
        }
        // Not emitting Deposit events since the Reserve strategies would do so
    }
}
