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
import {IUniswapV4ERC4626RebalanceModule} from "contracts/interfaces/automation/IUniswapV4ERC4626RebalanceModule.sol";
import {IPermit2} from "contracts/interfaces/uniswap/IPermit2.sol";
import {IPoolManager, PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";
import {IPositionManager} from "contracts/interfaces/uniswap/v4/IPositionManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISafeProxyFactory {
    function createProxyWithNonce(address singleton, bytes memory initializer, uint256 saltNonce)
        external
        returns (address proxy);
}

interface ISafeSetup {
    function setup(
        address[] calldata owners,
        uint256 threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address paymentReceiver
    ) external;

    function enableModule(address module) external;
}

/// @dev Runs against a fresh OUSD/sUSDe pool (fee 1 pip, so it does not collide with the live
///      fee-0 pool) and a fresh Safe. Ticks are derived from the sUSDe NAV at the fork block:
///      the pool is initialized at the NAV, whose tick is `navTick`.
abstract contract Fork_Mainnet_UniswapV4ERC4626RebalanceModule_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    /// @dev ~14k OUSD on a 5-tick range around tick -2257.
    uint128 internal constant LIQUIDITY = 50_000_000e18;
    uint128 internal constant MAX_AMOUNT0 = 100_000e18;
    uint128 internal constant RESET_AMOUNT0 = 1_000e18;
    uint256 internal constant SAFE_OUSD = 100_000e18;
    uint256 internal constant POOLS_SLOT = 6;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IUniswapV4ERC4626RebalanceModule internal module;
    IPoolManager internal poolManager;
    IPositionManager internal positionManager;
    IPermit2 internal permit2;
    IOToken internal ousd;
    IERC20 internal susde;
    V4Swapper internal trader;
    V4Swapper internal otherLp;
    address internal safe;

    PoolKey internal key;
    uint256 internal tokenId;
    /// @dev Tick of the NAV at the fork block; [navTick + 1, navTick + 6] is the first range.
    int24 internal navTick;
    uint160 internal navSqrtPriceX96;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();

        poolManager = IPoolManager(Mainnet.uniswapV4PoolManager);
        positionManager = IPositionManager(Mainnet.uniswapV4PositionManager);
        permit2 = IPermit2(Mainnet.permit2);
        ousd = IOToken(Mainnet.OUSDProxy);
        susde = IERC20(Mainnet.sUSDe);

        safe = _deploySafe();
        key = PoolKey({currency0: address(ousd), currency1: address(susde), fee: 1, tickSpacing: 1, hooks: address(0)});
        module = _deployModule(safe, key);
        vm.prank(safe);
        ISafeSetup(safe).enableModule(address(module));

        navSqrtPriceX96 = _navSqrtPriceX96();
        navTick = poolManager.initialize(key, navSqrtPriceX96);

        _mintOusd(safe, SAFE_OUSD);
        tokenId = _mintSafePosition(navTick + 1, navTick + 6);

        trader = new V4Swapper(address(poolManager));
        otherLp = new V4Swapper(address(poolManager));
        deal(address(susde), address(trader), 1_000_000e18);
        _mintOusd(address(trader), 1_000_000e18);
        _mintOusd(address(otherLp), 1_000_000e18);

        label();
    }

    function _deployModule(address _safe, PoolKey memory _key) internal returns (IUniswapV4ERC4626RebalanceModule) {
        return IUniswapV4ERC4626RebalanceModule(
            vm.deployCode(
                Automation.UNISWAP_V4_ERC4626_REBALANCE_MODULE,
                abi.encode(_safe, operator, address(poolManager), address(positionManager), _key, MAX_AMOUNT0)
            )
        );
    }

    function _deploySafe() internal returns (address) {
        address[] memory owners = new address[](1);
        owners[0] = makeAddr("SafeOwner");
        bytes memory initializer =
            abi.encodeCall(ISafeSetup.setup, (owners, 1, address(0), "", address(0), address(0), 0, address(0)));
        return ISafeProxyFactory(Mainnet.safeProxyFactory)
            .createProxyWithNonce(Mainnet.safeSingleton, initializer, uint256(keccak256("OUSDv4SusdeSafe")));
    }

    function _mintOusd(address to, uint256 amount) internal {
        vm.prank(ousd.vaultAddress());
        ousd.mint(to, amount);
    }

    /// @dev The Safe's one-time setup (OUSD to Permit2, Permit2 to the PositionManager, both at
    ///      max) and an OUSD-only position, minted by the Safe itself.
    function _mintSafePosition(int24 tickLower, int24 tickUpper) internal returns (uint256 id) {
        id = positionManager.nextTokenId();

        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(key, tickLower, tickUpper, uint256(LIQUIDITY), MAX_AMOUNT0, uint128(0), safe, bytes(""));
        params[1] = abi.encode(key.currency0, key.currency1);

        vm.startPrank(safe);
        ousd.approve(address(permit2), type(uint256).max);
        permit2.approve(address(ousd), address(positionManager), type(uint160).max, type(uint48).max);
        positionManager.modifyLiquidities(
            abi.encode(abi.encodePacked(uint8(0x02), uint8(0x0d)), params), block.timestamp
        );
        vm.stopPrank();
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev A user sells sUSDe for OUSD. This is the flow the position exists for.
    function _sellSusde(uint256 amount) internal returns (uint256 ousdOut) {
        ousdOut = trader.swap(key, false, amount);
    }

    /// @dev Someone sells OUSD for sUSDe, i.e. buys the sUSDe in the pool back.
    function _buySusde(uint256 ousdIn) internal returns (uint256 susdeOut) {
        susdeOut = trader.swap(key, true, ousdIn);
    }

    /// @dev What Talos sends: move the position to [lower, lower + 5] and, when the price sits
    ///      above the NAV, reset it down to the NAV (v4 rejects a limit at or above the price).
    function _rebalance(int24 tickLower) internal returns (uint256 newTokenId) {
        newTokenId = _rebalance(tickLower, LIQUIDITY);
    }

    function _rebalance(int24 tickLower, uint128 liquidity) internal returns (uint256 newTokenId) {
        uint160 limit = _navSqrtPriceX96();
        (uint160 price,) = _slot0();
        vm.prank(operator);
        newTokenId =
            module.rebalance(tokenId, tickLower, tickLower + 5, liquidity, price > limit ? RESET_AMOUNT0 : 0, limit);
        tokenId = newTokenId;
    }

    /// @dev Smallest sqrtPriceX96 at or above the NAV.
    function _navSqrtPriceX96() internal view returns (uint160) {
        uint256 x = module.navPriceX192();
        uint256 r = _sqrt(x);
        if (r * r < x) r++;
        return uint160(r);
    }

    function _slot0() internal view returns (uint160 sqrtPriceX96, int24 tick) {
        uint256 slot0 = uint256(poolManager.extsload(keccak256(abi.encode(keccak256(abi.encode(key)), POOLS_SLOT))));
        sqrtPriceX96 = uint160(slot0);
        tick = int24(int256(slot0 >> 160));
    }

    function _liquidity(uint256 id) internal view returns (uint128) {
        return positionManager.getPositionLiquidity(id);
    }

    function _range(uint256 id) internal view returns (int24 tickLower, int24 tickUpper) {
        (, uint256 info) = positionManager.getPoolAndPositionInfo(id);
        tickLower = int24(int256(info >> 8));
        tickUpper = int24(int256(info >> 32));
    }

    /// @dev Raise the sUSDe NAV by `bps`, as vested rewards do, by donating USDe to the vault.
    function _raiseNav(uint256 bps) internal {
        uint256 assets = IERC20(Mainnet.USDe).balanceOf(address(susde));
        deal(Mainnet.USDe, address(susde), assets + (assets * bps) / 10_000);
    }

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x >> 1) + 1;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) >> 1;
        }
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(safe, "LiquiditySafe");
        vm.label(address(module), "UniswapV4ERC4626RebalanceModule");
        vm.label(address(poolManager), "PoolManager");
        vm.label(address(positionManager), "PositionManager");
        vm.label(address(permit2), "Permit2");
        vm.label(address(ousd), "OUSD");
        vm.label(address(susde), "sUSDe");
        vm.label(address(trader), "Trader");
        vm.label(address(otherLp), "OtherLP");
    }
}
