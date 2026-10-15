// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";

// --- Project imports
import {IUniswapV4ERC4626RebalanceModule} from "contracts/interfaces/automation/IUniswapV4ERC4626RebalanceModule.sol";
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

// --- Mocks
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockERC4626Rate} from "tests/mocks/MockERC4626Rate.sol";
import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {MockPermit2} from "tests/mocks/MockPermit2.sol";
import {MockV4PoolManager} from "tests/mocks/MockV4PoolManager.sol";
import {MockV4PositionManager} from "tests/mocks/MockV4PositionManager.sol";

abstract contract Unit_UniswapV4ERC4626RebalanceModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint256 internal constant TOKEN_ID = 457274;
    int24 internal constant TICK_LOWER = -2252;
    int24 internal constant TICK_UPPER = -2238;
    /// @dev 0.8 shares per asset.
    uint256 internal constant SHARES_PER_ASSET = 0.8e18;
    /// @dev Smallest sqrtPriceX96 whose square is at or above 0.8 * 2^192.
    uint160 internal constant SQRT_PRICE_NAV = 70863822845718284118440686465;

    uint128 internal constant LIQUIDITY = 70_000_000e18;
    uint128 internal constant MAX_AMOUNT0 = 100_000e18;
    uint128 internal constant RESET_AMOUNT0 = 1_000e18;
    uint256 internal constant SAFE_TOKEN0 = 100_000e18;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    IUniswapV4ERC4626RebalanceModule internal module;
    MockSafeContract internal mockSafe;
    MockPermit2 internal permit2;
    MockV4PoolManager internal poolManager;
    MockV4PositionManager internal positionManager;
    MockERC20 internal token0;
    MockERC4626Rate internal token1;

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
        token1 = new MockERC4626Rate("Staked USDe", "sUSDe");
        token1.setSharesPerAsset(SHARES_PER_ASSET);

        key = PoolKey({
            currency0: address(token0), currency1: address(token1), fee: 0, tickSpacing: 1, hooks: address(0)
        });
        poolId = keccak256(abi.encode(key));
        module = _deployModule(operator, key);

        positionManager.setPosition(TOKEN_ID, address(mockSafe), key, TICK_LOWER, TICK_UPPER, LIQUIDITY);
        poolManager.setSqrtPrice(poolId, SQRT_PRICE_NAV);

        // The Safe's one-time setup: approve token0 to Permit2 and Permit2 to the PositionManager.
        token0.mint(address(mockSafe), SAFE_TOKEN0);
        vm.startPrank(address(mockSafe));
        token0.approve(address(permit2), type(uint256).max);
        permit2.approve(address(token0), address(positionManager), type(uint160).max, type(uint48).max);
        vm.stopPrank();

        // What the mocks pay out on burns and swaps.
        token0.mint(address(positionManager), 1_000_000e18);
        token1.mint(address(positionManager), 1_000_000e18);
        token1.mint(address(poolManager), 1_000_000e18);

        label();
    }

    function _deployModule(address _operator, PoolKey memory _key) internal returns (IUniswapV4ERC4626RebalanceModule) {
        return IUniswapV4ERC4626RebalanceModule(
            vm.deployCode(
                Automation.UNISWAP_V4_ERC4626_REBALANCE_MODULE,
                abi.encode(
                    address(mockSafe), _operator, address(poolManager), address(positionManager), _key, MAX_AMOUNT0
                )
            )
        );
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _rebalance(
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint128 resetAmount0,
        uint160 sqrtPriceLimitX96
    ) internal returns (uint256) {
        vm.prank(operator);
        return module.rebalance(TOKEN_ID, tickLower, tickUpper, liquidity, resetAmount0, sqrtPriceLimitX96);
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(address(module), "UniswapV4ERC4626RebalanceModule");
        vm.label(address(permit2), "MockPermit2");
        vm.label(address(poolManager), "MockV4PoolManager");
        vm.label(address(positionManager), "MockV4PositionManager");
        vm.label(address(token0), "OUSD");
        vm.label(address(token1), "sUSDe");
    }
}
