// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Strategies} from "tests/utils/artifacts/Strategies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";
import {Vaults} from "tests/utils/artifacts/Vaults.sol";

// Interfaces
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IBaseCurveAMOStrategy} from "contracts/interfaces/strategies/IBaseCurveAMOStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Mocks
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";
import {MockCurvePool} from "tests/mocks/MockCurvePool.sol";
import {MockCurveGauge} from "tests/mocks/MockCurveGauge.sol";
import {MockCurveGaugeFactory} from "tests/mocks/MockCurveGaugeFactory.sol";

abstract contract Unit_BaseCurveAMOStrategy_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & PROXIES
    //////////////////////////////////////////////////////

    MockWETH internal mockWeth;
    IOToken internal oeth;
    IVault internal oethVault;
    IProxy internal oethProxy;
    IProxy internal oethVaultProxy;
    IBaseCurveAMOStrategy internal baseCurveAMOStrategy;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;
    uint256 internal constant DEFAULT_MAX_SLIPPAGE = 1e16; // 1%

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    MockCurvePool internal curvePool;
    MockCurveGauge internal curveGauge;
    MockCurveGaugeFactory internal curveGaugeFactory;
    MockERC20 internal crvToken;
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

        // Deploy real OETH + OETHVault
        vm.startPrank(deployer);

        IOToken oethImpl = IOToken(vm.deployCode(Tokens.OETH));
        address oethVaultImpl = vm.deployCode(Vaults.OETH, abi.encode(address(mockWeth)));

        oethProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        oethVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        oethProxy.initialize(
            address(oethImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oeth = IOToken(address(oethProxy));
        oethVault = IVault(address(oethVaultProxy));

        // Configure vault
        vm.startPrank(governor);
        oethVault.unpauseCapital();
        oethVault.setStrategistAddr(strategist);
        oethVault.setMaxSupplyDiff(5e16);
        oethVault.setDripDuration(0);
        oethVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // Deploy Curve mocks
        // coin[0] = weth, coin[1] = oeth
        curvePool = new MockCurvePool(address(mockWeth), address(oeth));
        curveGauge = new MockCurveGauge(address(curvePool));
        curveGaugeFactory = new MockCurveGaugeFactory();
        crvToken = new MockERC20("Curve DAO Token", "CRV", 18);

        // Deploy BaseCurveAMOStrategy
        baseCurveAMOStrategy = IBaseCurveAMOStrategy(
            vm.deployCode(
                Strategies.BASE_CURVE_AMO_STRATEGY,
                abi.encode(
                    address(curvePool),
                    address(oethVault),
                    address(oeth),
                    address(mockWeth),
                    address(curveGauge),
                    address(curveGaugeFactory),
                    uint128(1), // oethCoinIndex
                    uint128(0) // wethCoinIndex
                )
            )
        );

        // Set governor via slot
        vm.store(address(baseCurveAMOStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize
        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(crvToken);
        vm.prank(governor);
        baseCurveAMOStrategy.initialize(rewardTokens, DEFAULT_MAX_SLIPPAGE);

        // Register strategy
        vm.startPrank(governor);
        oethVault.approveStrategy(address(baseCurveAMOStrategy));
        oethVault.addStrategyToMintWhitelist(address(baseCurveAMOStrategy));
        vm.stopPrank();

        // Set harvester
        harvester = makeAddr("Harvester");
        vm.prank(governor);
        baseCurveAMOStrategy.setHarvesterAddress(harvester);
    }

    function _labelContracts() internal {
        vm.label(address(baseCurveAMOStrategy), "BaseCurveAMOStrategy");
        vm.label(address(curvePool), "MockCurvePool");
        vm.label(address(curveGauge), "MockCurveGauge");
        vm.label(address(curveGaugeFactory), "MockCurveGaugeFactory");
        vm.label(address(crvToken), "CRV");
        vm.label(address(mockWeth), "MockWETH");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(harvester, "Harvester");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal WETH to strategy then call deposit as vault
    function _depositAsVault(uint256 amount) internal {
        deal(address(weth), address(baseCurveAMOStrategy), amount);
        vm.prank(address(oethVault));
        baseCurveAMOStrategy.deposit(address(weth), amount);
    }

    /// @dev Set mock pool balances and ensure the pool contract has the tokens
    function _setupPoolBalances(uint256 wethBal, uint256 oethBal) internal {
        curvePool.setBalances(wethBal, oethBal);
        // Deal WETH to pool
        deal(address(weth), address(curvePool), wethBal);
        // Mint OETH to pool via vault
        if (oethBal > 0) {
            vm.prank(address(oethVault));
            oeth.mint(address(curvePool), oethBal);
        }
    }

    /// @dev Seed the vault with WETH to ensure solvency
    function _seedVaultForSolvency(uint256 amount) internal {
        deal(address(weth), address(oethVault), amount);
    }
}
