// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";
import {Mainnet} from "tests/utils/Addresses.sol";
import {V4Swapper} from "tests/fork/mainnet/automation/UniswapV4RebalanceModule/shared/V4Swapper.sol";

// --- Project imports
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IUniswapV4LiquidityModule} from "contracts/interfaces/automation/IUniswapV4LiquidityModule.sol";
import {IPermit2} from "contracts/interfaces/uniswap/IPermit2.sol";
import {IPoolManager, PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";
import {IPositionManager} from "contracts/interfaces/uniswap/v4/IPositionManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISafeModules {
    function enableModule(address module) external;
}

/// @dev Runs a freshly deployed module on the live OUSD v4 liquidity Safe and the live, fee-0
///      OUSD/USDe pool, configured as the 010 deploy script does. The Safe and the position only
///      exist from block 26181117, so the suite skips on older fork pins.
abstract contract Fork_Mainnet_UniswapV4LiquidityModule_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint256 internal constant MAX_PER_CALL = 100_000e18;
    uint256 internal constant MAX_PER_DAY = 200_000e18;
    uint128 internal constant RESET_AMOUNT = 100e18;
    uint256 internal constant POOLS_SLOT = 6;
    /// @dev ~20k OUSD on one tick.
    uint128 internal constant ONE_TICK_LIQUIDITY = 400_000_000e18;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IUniswapV4LiquidityModule internal module;
    IPoolManager internal poolManager;
    IPositionManager internal positionManager;
    IPermit2 internal permit2;
    IOToken internal ousd;
    IERC20 internal usde;
    V4Swapper internal trader;
    address internal safe;

    PoolKey internal key;
    bytes32 internal poolId;
    uint256 internal tokenId;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();

        poolManager = IPoolManager(Mainnet.uniswapV4PoolManager);
        positionManager = IPositionManager(Mainnet.uniswapV4PositionManager);
        if (
            Mainnet.ousdV4LiquiditySafe.code.length == 0
                || positionManager.nextTokenId() <= Mainnet.ousdUsdeV4PositionId
        ) {
            vm.skip(true);
        }

        permit2 = IPermit2(Mainnet.permit2);
        ousd = IOToken(Mainnet.OUSDProxy);
        usde = IERC20(Mainnet.USDe);
        safe = Mainnet.ousdV4LiquiditySafe;
        key = PoolKey({currency0: address(ousd), currency1: address(usde), fee: 0, tickSpacing: 1, hooks: address(0)});
        poolId = keccak256(abi.encode(key));
        tokenId = Mainnet.ousdUsdeV4PositionId;

        module = IUniswapV4LiquidityModule(
            vm.deployCode(
                Automation.UNISWAP_V4_LIQUIDITY_MODULE,
                abi.encode(safe, operator, address(poolManager), address(positionManager))
            )
        );

        // Post-deploy Safe transactions, as in the 010 deploy script (approvals idempotent).
        vm.startPrank(safe);
        ISafeModules(safe).enableModule(address(module));
        module.allowPool(key);
        module.setMaxPerCall(address(ousd), MAX_PER_CALL);
        module.setMaxPerDay(address(ousd), MAX_PER_DAY);
        ousd.approve(address(permit2), type(uint256).max);
        permit2.approve(address(ousd), address(positionManager), type(uint160).max, type(uint48).max);
        vm.stopPrank();

        // Enough OUSD in the Safe to fund the tests, whatever the live balances are.
        vm.prank(ousd.vaultAddress());
        ousd.mint(safe, 100_000e18);

        trader = new V4Swapper(address(poolManager));
        deal(address(usde), address(trader), 1_000_000e18);

        label();
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev What Talos sends: burn the current position, reset the price down to the new range
    ///      bottom when it sits above it, mint OUSD only on [lower, lower + 1].
    function _rebalance(int24 tickLower, uint128 liquidity) internal returns (uint256 newTokenId) {
        uint160 limit = _sqrtPriceAtTick(tickLower);
        (uint160 price,) = _slot0();
        IUniswapV4LiquidityModule.RebalanceParams memory p;
        p.key = key;
        p.tokenId = tokenId;
        p.tickLower = tickLower;
        p.tickUpper = tickLower + 1;
        p.liquidity = liquidity;
        p.amount0Max = uint128(MAX_PER_CALL);
        p.resetZeroForOne = true;
        p.resetAmountIn = price > limit ? RESET_AMOUNT : 0;
        p.sqrtPriceLimitX96 = limit;
        vm.prank(operator);
        newTokenId = module.rebalance(p);
        tokenId = newTokenId;
    }

    /// @dev A user sells USDe for OUSD, the flow the position exists for.
    function _sellUsde(uint256 amount) internal returns (uint256 ousdOut) {
        ousdOut = trader.swap(key, false, amount);
    }

    function _slot0() internal view returns (uint160 sqrtPriceX96, int24 tick) {
        uint256 slot0 = uint256(poolManager.extsload(keccak256(abi.encode(poolId, POOLS_SLOT))));
        sqrtPriceX96 = uint160(slot0);
        tick = int24(int256(slot0 >> 160));
    }

    function _range(uint256 id) internal view returns (int24 tickLower, int24 tickUpper) {
        (, uint256 info) = positionManager.getPoolAndPositionInfo(id);
        tickLower = int24(int256(info >> 8));
        tickUpper = int24(int256(info >> 32));
    }

    /// @dev sqrt(1.0001^tick) * 2^96 for the small positive ticks these tests use (exact to well
    ///      under a tick).
    function _sqrtPriceAtTick(int24 tick) internal pure returns (uint160) {
        uint256 r = 79228162514264337593543950336;
        // sqrt(1.0001) in Q96, applied `tick` times.
        for (int24 i = 0; i < tick; i++) {
            r = (r * 79232123823359799118286999568) >> 96;
        }
        return uint160(r);
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(safe, "OUSDv4LiquiditySafe");
        vm.label(address(module), "UniswapV4LiquidityModule");
        vm.label(address(poolManager), "PoolManager");
        vm.label(address(positionManager), "PositionManager");
        vm.label(address(permit2), "Permit2");
        vm.label(address(ousd), "OUSD");
        vm.label(address(usde), "USDe");
        vm.label(address(trader), "Trader");
    }
}
