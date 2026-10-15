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
import {IUniswapV4RebalanceModule} from "contracts/interfaces/automation/IUniswapV4RebalanceModule.sol";
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

/// @dev Runs against a fresh OUSD/USDe pool (fee 1 pip, so it does not collide with the live
///      fee-0 pool) and a fresh Safe, so nothing depends on the state of the live position.
abstract contract Fork_Mainnet_UniswapV4RebalanceModule_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint256 internal constant Q96 = 2 ** 96;
    int24 internal constant TICK_LOWER = 0;
    int24 internal constant TICK_UPPER = 5;
    /// @dev Same liquidity as the live position: ~20k OUSD on [0, 5].
    uint128 internal constant TARGET_LIQUIDITY = Mainnet.ousdUsdeV4PositionLiquidity;
    uint128 internal constant MAX_AMOUNT0 = 100_000e18;
    uint128 internal constant RESET_AMOUNT0 = 1_000e18;
    uint256 internal constant SAFE_OUSD = 100_000e18;
    /// @dev The range bottom (tick 0) is par, which is also the module's floor.
    uint160 internal constant SQRT_PRICE_PAR = 79228162514264337593543950336;
    /// @dev getSqrtPriceAtTick(5), the range top.
    uint160 internal constant SQRT_PRICE_TICK_5 = 79247971040445709311708648151;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IUniswapV4RebalanceModule internal module;
    IPoolManager internal poolManager;
    IPositionManager internal positionManager;
    IPermit2 internal permit2;
    IOToken internal ousd;
    IERC20 internal usde;
    V4Swapper internal trader;
    V4Swapper internal otherLp;
    address internal safe;

    PoolKey internal key;
    uint256 internal tokenId;

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
        usde = IERC20(Mainnet.USDe);

        safe = _deploySafe();
        key = PoolKey({currency0: address(ousd), currency1: address(usde), fee: 1, tickSpacing: 1, hooks: address(0)});
        module = IUniswapV4RebalanceModule(
            vm.deployCode(
                Automation.UNISWAP_V4_REBALANCE_MODULE,
                abi.encode(
                    safe, operator, address(poolManager), address(positionManager), key, SQRT_PRICE_PAR, MAX_AMOUNT0
                )
            )
        );
        vm.prank(safe);
        ISafeSetup(safe).enableModule(address(module));

        // Just below tick 0, so an OUSD-only position on [0, 5] can be minted.
        poolManager.initialize(key, uint160((Q96 * 9999) / 10000));

        _mintOusd(safe, SAFE_OUSD);
        tokenId = _mintSafePosition();

        trader = new V4Swapper(address(poolManager));
        otherLp = new V4Swapper(address(poolManager));
        deal(address(usde), address(trader), 1_000_000e18);
        _mintOusd(address(trader), 1_000_000e18);
        _mintOusd(address(otherLp), 1_000_000e18);

        label();
    }

    function _deploySafe() internal returns (address) {
        address[] memory owners = new address[](1);
        owners[0] = makeAddr("SafeOwner");
        bytes memory initializer =
            abi.encodeCall(ISafeSetup.setup, (owners, 1, address(0), "", address(0), address(0), 0, address(0)));
        return ISafeProxyFactory(Mainnet.safeProxyFactory)
            .createProxyWithNonce(Mainnet.safeSingleton, initializer, uint256(keccak256("OUSDv4LiquiditySafe")));
    }

    function _mintOusd(address to, uint256 amount) internal {
        vm.prank(ousd.vaultAddress());
        ousd.mint(to, amount);
    }

    /// @dev The Safe's one-time setup (OUSD to Permit2, Permit2 to the PositionManager, both at
    ///      max) and the OUSD-only position on [0, 5].
    function _mintSafePosition() internal returns (uint256 id) {
        id = positionManager.nextTokenId();

        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(
            key, TICK_LOWER, TICK_UPPER, uint256(TARGET_LIQUIDITY), MAX_AMOUNT0, uint128(0), safe, bytes("")
        );
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

    /// @dev A user sells USDe for OUSD. This is the flow the position exists for.
    function _sellUsde(uint256 amount) internal returns (uint256 ousdOut) {
        ousdOut = trader.swap(key, false, amount);
    }

    /// @dev Someone sells OUSD for USDe, i.e. buys the USDe in the pool back.
    function _buyUsde(uint256 ousdIn) internal returns (uint256 usdeOut) {
        usdeOut = trader.swap(key, true, ousdIn);
    }

    /// @dev What Talos sends: re-add the target liquidity and, when the price sits in or above
    ///      the range, reset it down to the range bottom.
    function _rebalance() internal {
        _rebalance(TARGET_LIQUIDITY, _sqrtPrice() > SQRT_PRICE_PAR ? RESET_AMOUNT0 : 0);
    }

    function _rebalance(uint128 liquidityToAdd, uint128 resetAmount0) internal {
        vm.prank(operator);
        module.rebalance(tokenId, liquidityToAdd, resetAmount0, SQRT_PRICE_PAR);
    }

    function _sqrtPrice() internal view returns (uint160) {
        bytes32 slot0 = poolManager.extsload(keccak256(abi.encode(keccak256(abi.encode(key)), uint256(6))));
        return uint160(uint256(slot0));
    }

    /// @dev USDe the position holds, as Talos computes it.
    function _pendingUsde() internal view returns (uint256) {
        uint160 price = _sqrtPrice();
        if (price <= SQRT_PRICE_PAR) return 0;
        uint160 top = price < SQRT_PRICE_TICK_5 ? price : SQRT_PRICE_TICK_5;
        return (uint256(_liquidity()) * (top - SQRT_PRICE_PAR)) / Q96;
    }

    function _liquidity() internal view returns (uint128) {
        return positionManager.getPositionLiquidity(tokenId);
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(safe, "LiquiditySafe");
        vm.label(address(module), "UniswapV4RebalanceModule");
        vm.label(address(poolManager), "PoolManager");
        vm.label(address(positionManager), "PositionManager");
        vm.label(address(permit2), "Permit2");
        vm.label(address(ousd), "OUSD");
        vm.label(address(usde), "USDe");
        vm.label(address(trader), "Trader");
        vm.label(address(otherLp), "OtherLP");
    }
}
