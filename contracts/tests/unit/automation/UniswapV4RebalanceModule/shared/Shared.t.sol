// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";

// --- Project imports
import {IUniswapV4RebalanceModule} from "contracts/interfaces/automation/IUniswapV4RebalanceModule.sol";
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

// --- Mocks
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {MockPermit2} from "tests/mocks/MockPermit2.sol";
import {MockV4PoolManager} from "tests/mocks/MockV4PoolManager.sol";
import {MockV4PositionManager} from "tests/mocks/MockV4PositionManager.sol";

abstract contract Unit_UniswapV4RebalanceModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint256 internal constant TOKEN_ID = 457273;
    int24 internal constant TICK_LOWER = 0;
    int24 internal constant TICK_UPPER = 5;
    uint160 internal constant SQRT_PRICE_TICK_0 = 79228162514264337593543950336;
    /// @dev getSqrtPriceAtTick(5), checked against the module in the constructor tests.
    uint160 internal constant SQRT_PRICE_TICK_5 = 79247971040445709311708648151;

    uint128 internal constant TARGET_LIQUIDITY = 80014000349982500743725934;
    uint128 internal constant MAX_AMOUNT0 = 20_200e18;
    uint128 internal constant MAX_RESET_AMOUNT0 = 1_000e18;
    uint256 internal constant MAX_TOKEN1_IN_SAFE = 100_000e18;
    uint256 internal constant SAFE_TOKEN0 = 100_000e18;
    int24 internal constant MIN_TICK_LOWER = 0;
    int24 internal constant MAX_TICK_LOWER = 50;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    IUniswapV4RebalanceModule internal module;
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

        _deployContracts();
        _configureContracts();
        label();
    }

    function _deployContracts() internal {
        mockSafe = new MockSafeContract();
        permit2 = new MockPermit2();
        poolManager = new MockV4PoolManager();
        positionManager = new MockV4PositionManager(address(permit2));
        token0 = new MockERC20("Origin Dollar", "OUSD", 18);
        token1 = new MockERC20("Ethena USDe", "USDe", 18);

        module = IUniswapV4RebalanceModule(
            vm.deployCode(
                Automation.UNISWAP_V4_REBALANCE_MODULE,
                abi.encode(
                    address(mockSafe), operator, address(poolManager), address(positionManager), address(permit2)
                )
            )
        );
    }

    function _configureContracts() internal {
        key = PoolKey({
            currency0: address(token0), currency1: address(token1), fee: 0, tickSpacing: 1, hooks: address(0)
        });
        poolId = keccak256(abi.encode(key));

        positionManager.setPosition(TOKEN_ID, address(mockSafe), key, TICK_LOWER, TICK_UPPER, TARGET_LIQUIDITY);
        _setPrice(SQRT_PRICE_TICK_0);

        token0.mint(address(mockSafe), SAFE_TOKEN0);
        // Liquidity the mocks pay out on decreases and swaps.
        token0.mint(address(positionManager), 1_000_000e18);
        token1.mint(address(positionManager), 1_000_000e18);
        token1.mint(address(poolManager), 1_000_000e18);

        _configurePosition();
    }

    function _configurePosition() internal {
        vm.prank(address(mockSafe));
        module.configurePosition(
            TOKEN_ID, _limits(TARGET_LIQUIDITY, MAX_AMOUNT0, MAX_RESET_AMOUNT0, MAX_TOKEN1_IN_SAFE)
        );
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _limits(uint128 targetLiquidity, uint128 maxAmount0, uint128 maxResetAmount0, uint256 maxToken1InSafe)
        internal
        pure
        returns (IUniswapV4RebalanceModule.PositionLimits memory)
    {
        return IUniswapV4RebalanceModule.PositionLimits({
            targetLiquidity: targetLiquidity,
            maxAmount0: maxAmount0,
            maxResetAmount0: maxResetAmount0,
            maxToken1InSafe: maxToken1InSafe,
            minTickLower: MIN_TICK_LOWER,
            maxTickLower: MAX_TICK_LOWER
        });
    }

    function _setPrice(uint160 sqrtPriceX96) internal {
        poolManager.setSqrtPrice(poolId, sqrtPriceX96);
    }

    /// @dev A price inside [0, 5]: the position holds some token1.
    function _priceInRange() internal pure returns (uint160) {
        return SQRT_PRICE_TICK_0 + (SQRT_PRICE_TICK_5 - SQRT_PRICE_TICK_0) / 2;
    }

    /// @dev Price in range, a fill to pull, and a reset swap that trades nothing and lands on
    ///      the bottom of the range.
    function _setUpFill(uint256 pulled0, uint256 pulled1, uint256 added0) internal {
        _setPrice(_priceInRange());
        positionManager.setAmounts(pulled0, pulled1, added0, 0);
        poolManager.setSwapResult(0, 0, SQRT_PRICE_TICK_0);
    }

    function _rebalance() internal returns (bool added) {
        vm.prank(operator);
        added = module.rebalance(TOKEN_ID);
    }

    function _status() internal view returns (bool needed, IUniswapV4RebalanceModule.Reason reason) {
        return module.rebalanceStatus(TOKEN_ID);
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(address(module), "UniswapV4RebalanceModule");
        vm.label(address(permit2), "MockPermit2");
        vm.label(address(poolManager), "MockV4PoolManager");
        vm.label(address(positionManager), "MockV4PositionManager");
        vm.label(address(token0), "OUSD");
        vm.label(address(token1), "USDe");
    }
}
