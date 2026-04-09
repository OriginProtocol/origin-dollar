// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Strategies} from "tests/utils/artifacts/Strategies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";
import {Vaults} from "tests/utils/artifacts/Vaults.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

// --- Project imports
import {IAerodromeAMOStrategy} from "contracts/interfaces/strategies/IAerodromeAMOStrategy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {MockCLGauge} from "tests/mocks/aerodrome/MockCLGauge.sol";
import {MockCLPool} from "tests/mocks/aerodrome/MockCLPool.sol";
import {MockNonfungiblePositionManager} from "tests/mocks/aerodrome/MockNonfungiblePositionManager.sol";
import {MockSugarHelper} from "tests/mocks/aerodrome/MockSugarHelper.sol";
import {MockSwapRouter} from "tests/mocks/aerodrome/MockSwapRouter.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";

abstract contract Unit_AerodromeAMOStrategy_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & PROXIES (moved from Base)
    //////////////////////////////////////////////////////

    MockWETH internal mockWeth;
    IOToken internal oethBase;
    IVault internal oethBaseVault;
    IProxy internal oethBaseProxy;
    IProxy internal oethBaseVaultProxy;
    IAerodromeAMOStrategy internal aerodromeAMOStrategy;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    // Real sqrtRatioX96 values for ticks
    uint160 internal constant SQRT_RATIO_TICK_MINUS_1 = 79223823835061661006824;
    uint160 internal constant SQRT_RATIO_TICK_0 = 79228162514264337593543950336;

    // A valid mid-range price between tick -1 and tick 0
    // Approximately at the midpoint: ~50% WETH share
    uint160 internal constant DEFAULT_POOL_PRICE = 79225993174662999300183987080;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    MockCLPool internal mockCLPool;
    MockNonfungiblePositionManager internal mockPositionManager;
    MockCLGauge internal mockCLGauge;
    MockSwapRouter internal mockSwapRouter;
    MockSugarHelper internal mockSugarHelper;
    MockERC20 internal aeroToken;
    address internal harvester;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // Deploy real WETH
        mockWeth = new MockWETH();
        weth = IERC20(address(mockWeth));

        // Deploy real OETHBase + OETHBaseVault
        vm.startPrank(deployer);

        IOToken oethBaseImpl = IOToken(vm.deployCode(Tokens.OETH_BASE));
        address oethBaseVaultImpl = vm.deployCode(Vaults.OETH_BASE, abi.encode(address(mockWeth)));

        oethBaseProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        oethBaseVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        oethBaseProxy.initialize(
            address(oethBaseImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethBaseVaultProxy), 1e27)
        );

        oethBaseVaultProxy.initialize(
            address(oethBaseVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethBaseProxy))
        );

        vm.stopPrank();

        oethBase = IOToken(address(oethBaseProxy));
        oethBaseVault = IVault(address(oethBaseVaultProxy));

        // Configure vault
        vm.startPrank(governor);
        oethBaseVault.unpauseCapital();
        oethBaseVault.setStrategistAddr(strategist);
        oethBaseVault.setMaxSupplyDiff(5e16);
        oethBaseVault.setDripDuration(0);
        oethBaseVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // Deploy AERO reward token
        aeroToken = new MockERC20("Aerodrome", "AERO", 18);

        // Deploy mock Aerodrome protocol contracts
        mockCLPool = new MockCLPool(address(mockWeth), address(oethBase));
        mockPositionManager = new MockNonfungiblePositionManager();
        mockCLGauge = new MockCLGauge(address(mockPositionManager), address(aeroToken));
        mockSwapRouter = new MockSwapRouter();
        mockSugarHelper = new MockSugarHelper();

        // Set pool price within valid tick range [-1, 0]
        mockCLPool.setSlot0(DEFAULT_POOL_PRICE, -1);

        // Deploy AerodromeAMOStrategy
        // token0 = WETH, token1 = OETHb (constructor requires this ordering)
        // lowerBoundingTick = -1, upperBoundingTick = 0, tickClosestToParity = 0
        aerodromeAMOStrategy = IAerodromeAMOStrategy(
            vm.deployCode(
                Strategies.AERODROME_AMO_STRATEGY,
                abi.encode(
                    address(mockCLPool),
                    address(oethBaseVault),
                    address(mockWeth),
                    address(oethBase),
                    address(mockSwapRouter),
                    address(mockPositionManager),
                    address(mockCLPool),
                    address(mockCLGauge),
                    address(mockSugarHelper),
                    int24(-1),
                    int24(0),
                    int24(0)
                )
            )
        );

        // Reset initialization state (constructor uses `initializer` modifier
        // which marks the implementation as initialized, preventing initialize())
        vm.store(address(aerodromeAMOStrategy), bytes32(0), bytes32(0));

        // Set governor via storage slot
        vm.store(address(aerodromeAMOStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize with AERO reward token
        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(aeroToken);
        vm.prank(governor);
        aerodromeAMOStrategy.initialize(rewardTokens);

        // Configure allowed WETH share interval
        vm.prank(governor);
        aerodromeAMOStrategy.setAllowedPoolWethShareInterval(0.02 ether, 0.5 ether);

        // Approve all tokens (OETHb to positionManager and swapRouter)
        vm.prank(governor);
        aerodromeAMOStrategy.safeApproveAllTokens();

        // Register strategy with vault
        vm.startPrank(governor);
        oethBaseVault.approveStrategy(address(aerodromeAMOStrategy));
        oethBaseVault.addStrategyToMintWhitelist(address(aerodromeAMOStrategy));
        vm.stopPrank();

        // Set harvester
        harvester = makeAddr("Harvester");
        vm.prank(governor);
        aerodromeAMOStrategy.setHarvesterAddress(harvester);
    }

    function _labelContracts() internal {
        vm.label(address(aerodromeAMOStrategy), "AerodromeAMOStrategy");
        vm.label(address(mockWeth), "MockWETH");
        vm.label(address(oethBase), "OETHBase");
        vm.label(address(oethBaseVault), "OETHBaseVault");
        vm.label(address(mockCLPool), "MockCLPool");
        vm.label(address(mockPositionManager), "MockPositionManager");
        vm.label(address(mockCLGauge), "MockCLGauge");
        vm.label(address(mockSwapRouter), "MockSwapRouter");
        vm.label(address(mockSugarHelper), "MockSugarHelper");
        vm.label(address(aeroToken), "AERO");
        vm.label(harvester, "Harvester");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal WETH to strategy then call deposit as vault
    function _depositAsVault(uint256 amount) internal {
        deal(address(weth), address(aerodromeAMOStrategy), amount);
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.deposit(address(weth), amount);
    }

    /// @dev Set the mock pool price (sqrtPriceX96 and tick)
    function _setPoolPrice(uint160 sqrtPriceX96, int24 tick) internal {
        mockCLPool.setSlot0(sqrtPriceX96, tick);
    }

    /// @dev Set pool price out of range (below tick -1)
    function _setPoolPriceOutOfRange() internal {
        mockCLPool.setSlot0(SQRT_RATIO_TICK_MINUS_1 - 1, -2);
    }

    /// @dev Seed the vault with WETH to ensure solvency
    function _seedVaultForSolvency(uint256 amount) internal {
        deal(address(weth), address(oethBaseVault), amount);
    }
}
