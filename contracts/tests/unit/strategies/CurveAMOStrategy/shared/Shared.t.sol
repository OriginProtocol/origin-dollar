// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";
import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {OETHProxy} from "contracts/proxies/Proxies.sol";
import {OETHVaultProxy} from "contracts/proxies/Proxies.sol";
import {CurveAMOStrategy} from "contracts/strategies/CurveAMOStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {MockCurvePool} from "tests/mocks/MockCurvePool.sol";
import {MockCurveGauge} from "tests/mocks/MockCurveGauge.sol";
import {MockCurveMinter} from "tests/mocks/MockCurveMinter.sol";

abstract contract Unit_CurveAMOStrategy_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & PROXIES (moved from Base)
    //////////////////////////////////////////////////////

    MockWETH internal mockWeth;
    OETH internal oeth;
    OETHVault internal oethVault;
    OETHProxy internal oethProxy;
    OETHVaultProxy internal oethVaultProxy;
    CurveAMOStrategy internal curveAMOStrategy;

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
    MockCurveMinter internal curveMinter;
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

        OETH oethImpl = new OETH();
        OETHVault oethVaultImpl = new OETHVault(address(mockWeth));

        oethProxy = new OETHProxy();
        oethVaultProxy = new OETHVaultProxy();

        oethProxy.initialize(
            address(oethImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oeth = OETH(address(oethProxy));
        oethVault = OETHVault(address(oethVaultProxy));

        // Configure vault
        vm.startPrank(governor);
        oethVault.unpauseCapital();
        oethVault.setStrategistAddr(strategist);
        oethVault.setMaxSupplyDiff(5e16);
        oethVault.setDripDuration(0);
        oethVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // Deploy Curve mocks
        curvePool = new MockCurvePool(address(mockWeth), address(oeth));
        curveGauge = new MockCurveGauge(address(curvePool));
        curveMinter = new MockCurveMinter();
        crvToken = new MockERC20("Curve DAO Token", "CRV", 18);

        // Deploy CurveAMOStrategy
        // coin[0] = weth (hardAsset), coin[1] = oeth (oToken)
        curveAMOStrategy = new CurveAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(curvePool), vaultAddress: address(oethVault)
            }),
            address(oeth),
            address(mockWeth),
            address(curveGauge),
            address(curveMinter)
        );

        // Set governor via slot
        vm.store(address(curveAMOStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize
        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(crvToken);
        vm.prank(governor);
        curveAMOStrategy.initialize(rewardTokens, DEFAULT_MAX_SLIPPAGE);

        // Register strategy
        vm.startPrank(governor);
        oethVault.approveStrategy(address(curveAMOStrategy));
        oethVault.addStrategyToMintWhitelist(address(curveAMOStrategy));
        vm.stopPrank();

        // Set harvester
        harvester = makeAddr("Harvester");
        vm.prank(governor);
        curveAMOStrategy.setHarvesterAddress(harvester);
    }

    function _labelContracts() internal {
        vm.label(address(curveAMOStrategy), "CurveAMOStrategy");
        vm.label(address(curvePool), "MockCurvePool");
        vm.label(address(curveGauge), "MockCurveGauge");
        vm.label(address(curveMinter), "MockCurveMinter");
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
        deal(address(weth), address(curveAMOStrategy), amount);
        vm.prank(address(oethVault));
        curveAMOStrategy.deposit(address(weth), amount);
    }

    /// @dev Set mock pool balances and ensure the pool contract has the tokens
    function _setupPoolBalances(uint256 hardAssetBal, uint256 oTokenBal) internal {
        curvePool.setBalances(hardAssetBal, oTokenBal);
        // Deal WETH to pool
        deal(address(weth), address(curvePool), hardAssetBal);
        // Mint OETH to pool via vault
        if (oTokenBal > 0) {
            vm.prank(address(oethVault));
            oeth.mint(address(curvePool), oTokenBal);
        }
    }

    /// @dev Seed the vault with WETH to ensure solvency
    function _seedVaultForSolvency(uint256 amount) internal {
        deal(address(weth), address(oethVault), amount);
    }
}
