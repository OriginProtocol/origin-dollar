// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Proxies, Strategies, Tokens, Vaults} from "tests/utils/Artifacts.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {ICurveStableSwapNG} from "contracts/interfaces/ICurveStableSwapNG.sol";
import {ICurveLiquidityGaugeV6} from "contracts/interfaces/ICurveLiquidityGaugeV6.sol";
import {ICurveMinter} from "contracts/interfaces/ICurveMinter.sol";
import {ICurveStableSwapFactoryNG} from "contracts/interfaces/ICurveStableSwapFactoryNG.sol";
import {ICurveAMOStrategy} from "contracts/interfaces/strategies/ICurveAMOStrategy.sol";

abstract contract Fork_CurveAMOStrategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;
    uint256 internal constant DEFAULT_MAX_SLIPPAGE = 1e16; // 1%

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IOToken internal oeth;
    IVault internal oethVault;
    IProxy internal oethProxy;
    IProxy internal oethVaultProxy;
    ICurveAMOStrategy internal curveAMOStrategy;
    ICurveStableSwapNG internal curvePool;
    ICurveLiquidityGaugeV6 internal curveGauge;
    ICurveMinter internal curveMinter;
    address internal harvester;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();
        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // Assign from fork
        weth = IERC20(Mainnet.WETH);
        crv = IERC20(Mainnet.CRV);
        curveMinter = ICurveMinter(Mainnet.CRVMinter);

        // Deploy fresh OETH + OETHVault
        vm.startPrank(deployer);

        address oethImpl = vm.deployCode(Tokens.OETH);
        address oethVaultImpl = vm.deployCode(Vaults.OETH, abi.encode(Mainnet.WETH));

        oethProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        oethVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        oethProxy.initialize(
            oethImpl, governor, abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            oethVaultImpl, governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
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

        // Create Curve pool via factory
        ICurveStableSwapFactoryNG factory = ICurveStableSwapFactoryNG(Mainnet.CurveStableswapFactoryNG);

        address[] memory coins = new address[](2);
        coins[0] = Mainnet.WETH;
        coins[1] = address(oeth);

        uint8[] memory assetTypes = new uint8[](2);
        assetTypes[0] = 0;
        assetTypes[1] = 0;

        bytes4[] memory methodIds = new bytes4[](2);
        methodIds[0] = bytes4(0);
        methodIds[1] = bytes4(0);

        address[] memory oracles = new address[](2);
        oracles[0] = address(0);
        oracles[1] = address(0);

        address poolAddr = factory.deploy_plain_pool(
            "OETH/WETH Test",
            "oethWETH-t",
            coins,
            100, // A
            4000000, // fee
            20000000000, // offpeg_fee_multiplier
            866, // ma_exp_time
            0, // implementation_idx
            assetTypes,
            methodIds,
            oracles
        );

        curvePool = ICurveStableSwapNG(poolAddr);

        // Create gauge
        address gaugeAddr = factory.deploy_gauge(poolAddr);
        curveGauge = ICurveLiquidityGaugeV6(gaugeAddr);

        // Deploy CurveAMOStrategy
        curveAMOStrategy = ICurveAMOStrategy(
            vm.deployCode(
                Strategies.CURVE_AMO_STRATEGY,
                abi.encode(poolAddr, address(oethVault), address(oeth), Mainnet.WETH, gaugeAddr, Mainnet.CRVMinter)
            )
        );

        // Set governor via storage slot
        vm.store(address(curveAMOStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize strategy
        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = Mainnet.CRV;
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

        // Seed pool with balanced liquidity (100 WETH + 100 OETH)
        _seedPoolLiquidity(100 ether);

        // Seed vault for solvency
        _seedVaultForSolvency(1000 ether);
    }

    function _labelContracts() internal {
        vm.label(address(curveAMOStrategy), "CurveAMOStrategy");
        vm.label(address(curvePool), "CurvePool");
        vm.label(address(curveGauge), "CurveGauge");
        vm.label(Mainnet.CRVMinter, "CRVMinter");
        vm.label(Mainnet.CRV, "CRV");
        vm.label(Mainnet.WETH, "WETH");
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

    /// @dev Seed the vault with WETH to ensure solvency
    function _seedVaultForSolvency(uint256 amount) internal {
        deal(address(weth), address(oethVault), amount);
    }

    /// @dev Add balanced WETH+OETH liquidity to pool
    function _seedPoolLiquidity(uint256 amount) internal {
        // Deal WETH
        deal(Mainnet.WETH, address(this), amount);
        // Mint OETH via vault
        vm.prank(address(oethVault));
        oeth.mint(address(this), amount);

        // Approve pool
        IERC20(Mainnet.WETH).approve(address(curvePool), amount);
        oeth.approve(address(curvePool), amount);

        // Add liquidity
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = amount; // WETH (coin 0)
        amounts[1] = amount; // OETH (coin 1)
        curvePool.add_liquidity(amounts, 0);
    }

    /// @dev Tilt pool to hard asset by swapping WETH into pool (pool gets more WETH, less OETH)
    function _tiltPoolToHardAsset(uint256 swapAmount) internal {
        deal(Mainnet.WETH, address(this), swapAmount);
        IERC20(Mainnet.WETH).approve(address(curvePool), swapAmount);
        // Swap WETH -> OETH (pool gets more WETH)
        curvePool.exchange(0, 1, swapAmount, 0);
    }

    /// @dev Tilt pool to OToken by swapping OETH into pool (pool gets more OETH, less WETH)
    function _tiltPoolToOToken(uint256 swapAmount) internal {
        vm.prank(address(oethVault));
        oeth.mint(address(this), swapAmount);
        oeth.approve(address(curvePool), swapAmount);
        // Swap OETH -> WETH (pool gets more OETH)
        curvePool.exchange(1, 0, swapAmount, 0);
    }
}
