// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";

// --- Project imports
import {IUniswapV4LiquidityModule} from "contracts/interfaces/automation/IUniswapV4LiquidityModule.sol";
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

// --- Mocks
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {MockPermit2} from "tests/mocks/MockPermit2.sol";
import {MockV4PoolManager} from "tests/mocks/MockV4PoolManager.sol";
import {MockV4PositionManager} from "tests/mocks/MockV4PositionManager.sol";

abstract contract Unit_UniswapV4LiquidityModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint256 internal constant TOKEN_ID = 457273;
    int24 internal constant TICK_LOWER = 0;
    int24 internal constant TICK_UPPER = 5;
    /// @dev Par: 2^96.
    uint160 internal constant SQRT_PRICE_PAR = 79228162514264337593543950336;

    uint128 internal constant LIQUIDITY = 80_000_000e18;
    uint128 internal constant MAX_PER_CALL = 100_000e18;
    uint128 internal constant MAX_PER_DAY = 200_000e18;
    uint128 internal constant RESET_AMOUNT = 1_000e18;
    uint256 internal constant SAFE_TOKEN0 = 300_000e18;
    uint256 internal constant SAFE_TOKEN1 = 50_000e18;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    IUniswapV4LiquidityModule internal module;
    MockSafeContract internal mockSafe;
    MockPermit2 internal permit2;
    MockV4PoolManager internal poolManager;
    MockV4PositionManager internal positionManager;
    MockERC20 internal token0;
    MockERC20 internal token1;

    PoolKey internal key;
    bytes32 internal poolId;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        mockSafe = new MockSafeContract();
        permit2 = new MockPermit2();
        poolManager = new MockV4PoolManager();
        positionManager = new MockV4PositionManager(address(permit2));
        token0 = new MockERC20("Origin Dollar", "OUSD", 18);
        token1 = new MockERC20("USDe", "USDe", 18);

        key = PoolKey({
            currency0: address(token0), currency1: address(token1), fee: 0, tickSpacing: 1, hooks: address(0)
        });
        poolId = keccak256(abi.encode(key));
        module = _deployModule(operator);

        // The Safe's configuration: allow the pool, cap token0, leave token1 at 0.
        vm.startPrank(address(mockSafe));
        module.allowPool(key);
        module.setMaxPerCall(address(token0), MAX_PER_CALL);
        module.setMaxPerDay(address(token0), MAX_PER_DAY);
        vm.stopPrank();

        positionManager.setPosition(TOKEN_ID, address(mockSafe), key, TICK_LOWER, TICK_UPPER, LIQUIDITY);
        poolManager.setSqrtPrice(poolId, SQRT_PRICE_PAR);

        // The Safe's one-time setup: approve both tokens to Permit2 and Permit2 to the PositionManager.
        token0.mint(address(mockSafe), SAFE_TOKEN0);
        token1.mint(address(mockSafe), SAFE_TOKEN1);
        vm.startPrank(address(mockSafe));
        token0.approve(address(permit2), type(uint256).max);
        token1.approve(address(permit2), type(uint256).max);
        permit2.approve(address(token0), address(positionManager), type(uint160).max, type(uint48).max);
        permit2.approve(address(token1), address(positionManager), type(uint160).max, type(uint48).max);
        vm.stopPrank();

        // What the mocks pay out on burns and swaps.
        token0.mint(address(positionManager), 1_000_000e18);
        token1.mint(address(positionManager), 1_000_000e18);
        token0.mint(address(poolManager), 1_000_000e18);
        token1.mint(address(poolManager), 1_000_000e18);

        label();
    }

    function _deployModule(address _operator) internal returns (IUniswapV4LiquidityModule) {
        return IUniswapV4LiquidityModule(
            vm.deployCode(
                Automation.UNISWAP_V4_LIQUIDITY_MODULE,
                abi.encode(address(mockSafe), _operator, address(poolManager), address(positionManager))
            )
        );
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Burn TOKEN_ID, reset (zeroForOne) and mint, with the given amounts.
    function _params(int24 tickLower, int24 tickUpper, uint128 liquidity, uint128 amount0Max, uint128 resetAmountIn)
        internal
        view
        returns (IUniswapV4LiquidityModule.RebalanceParams memory p)
    {
        p.key = key;
        p.tokenId = TOKEN_ID;
        p.tickLower = tickLower;
        p.tickUpper = tickUpper;
        p.liquidity = liquidity;
        p.amount0Max = amount0Max;
        p.amount1Max = 0;
        p.resetZeroForOne = true;
        p.resetAmountIn = resetAmountIn;
        p.sqrtPriceLimitX96 = SQRT_PRICE_PAR;
    }

    function _rebalance(IUniswapV4LiquidityModule.RebalanceParams memory p) internal returns (uint256) {
        vm.prank(operator);
        return module.rebalance(p);
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(address(module), "UniswapV4LiquidityModule");
        vm.label(address(permit2), "MockPermit2");
        vm.label(address(poolManager), "MockV4PoolManager");
        vm.label(address(positionManager), "MockV4PositionManager");
        vm.label(address(token0), "OUSD");
        vm.label(address(token1), "USDe");
    }
}
