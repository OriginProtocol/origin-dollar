// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Strategies} from "tests/utils/artifacts/Strategies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";
import {Vaults} from "tests/utils/artifacts/Vaults.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {ICurveAMOStrategy} from "contracts/interfaces/strategies/ICurveAMOStrategy.sol";
import {ICurveLiquidityGaugeV6} from "contracts/interfaces/ICurveLiquidityGaugeV6.sol";
import {ICurveStableSwapFactoryNG} from "contracts/interfaces/ICurveStableSwapFactoryNG.sol";
import {ICurveStableSwapNG} from "contracts/interfaces/ICurveStableSwapNG.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IVault} from "contracts/interfaces/IVault.sol";

abstract contract Fork_CurveAMOStrategyOUSD_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;
    uint256 internal constant DEFAULT_MAX_SLIPPAGE = 1e16; // 1%
    uint256 internal constant USDC_SCALE = 1e12;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IOToken internal ousd;
    IVault internal ousdVault;
    IProxy internal ousdProxy;
    IProxy internal ousdVaultProxy;
    ICurveAMOStrategy internal curveAMOStrategy;
    ICurveStableSwapNG internal curvePool;
    ICurveLiquidityGaugeV6 internal curveGauge;

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
        usdc = IERC20(Mainnet.USDC);

        vm.startPrank(deployer);

        address ousdImpl = vm.deployCode(Tokens.OUSD);
        address ousdVaultImpl = vm.deployCode(Vaults.OUSD, abi.encode(Mainnet.USDC));

        ousdProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        ousdVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        ousdProxy.initialize(
            ousdImpl, governor, abi.encodeWithSignature("initialize(address,uint256)", address(ousdVaultProxy), 1e27)
        );
        ousdVaultProxy.initialize(
            ousdVaultImpl, governor, abi.encodeWithSignature("initialize(address)", address(ousdProxy))
        );

        vm.stopPrank();

        ousd = IOToken(address(ousdProxy));
        ousdVault = IVault(address(ousdVaultProxy));

        vm.startPrank(governor);
        ousdVault.unpauseCapital();
        ousdVault.setStrategistAddr(strategist);
        ousdVault.setMaxSupplyDiff(5e16);
        ousdVault.setDripDuration(0);
        ousdVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        ICurveStableSwapFactoryNG factory = ICurveStableSwapFactoryNG(Mainnet.CurveStableswapFactoryNG);

        address[] memory coins = new address[](2);
        coins[0] = address(ousd);
        coins[1] = Mainnet.USDC;

        uint8[] memory assetTypes = new uint8[](2);
        bytes4[] memory methodIds = new bytes4[](2);
        address[] memory oracles = new address[](2);

        address poolAddr = factory.deploy_plain_pool(
            "OUSD/USDC Test",
            "ousdUSDC-t",
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
        address gaugeAddr = factory.deploy_gauge(poolAddr);
        curveGauge = ICurveLiquidityGaugeV6(gaugeAddr);

        curveAMOStrategy = ICurveAMOStrategy(
            vm.deployCode(
                Strategies.CURVE_AMO_STRATEGY,
                abi.encode(poolAddr, address(ousdVault), address(ousd), Mainnet.USDC, gaugeAddr, Mainnet.CRVMinter)
            )
        );

        vm.store(address(curveAMOStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = Mainnet.CRV;
        vm.prank(governor);
        curveAMOStrategy.initialize(rewardTokens, DEFAULT_MAX_SLIPPAGE);

        vm.startPrank(governor);
        ousdVault.approveStrategy(address(curveAMOStrategy));
        ousdVault.addStrategyToMintWhitelist(address(curveAMOStrategy));
        vm.stopPrank();

        _seedPoolLiquidity(100 ether);
        _seedVaultForSolvency(1_000 ether);
    }

    function _labelContracts() internal {
        vm.label(address(curveAMOStrategy), "CurveAMOStrategy OUSD");
        vm.label(address(curvePool), "CurvePool OUSD/USDC");
        vm.label(address(curveGauge), "CurveGauge OUSD/USDC");
        vm.label(Mainnet.USDC, "USDC");
        vm.label(address(ousd), "OUSD");
        vm.label(address(ousdVault), "OUSDVault");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _depositAsVault(uint256 amount) internal {
        deal(address(usdc), address(curveAMOStrategy), amount);
        vm.prank(address(ousdVault));
        curveAMOStrategy.deposit(address(usdc), amount);
    }

    function _seedVaultForSolvency(uint256 amount18) internal {
        deal(address(usdc), address(ousdVault), amount18 / USDC_SCALE);
    }

    function _seedPoolLiquidity(uint256 amount18) internal {
        uint256 usdcAmount = amount18 / USDC_SCALE;
        deal(address(usdc), address(this), usdcAmount);
        vm.prank(address(ousdVault));
        ousd.mint(address(this), amount18);

        ousd.approve(address(curvePool), amount18);
        usdc.approve(address(curvePool), usdcAmount);

        uint256[] memory amounts = new uint256[](2);
        amounts[curveAMOStrategy.otokenCoinIndex()] = amount18;
        amounts[curveAMOStrategy.hardAssetCoinIndex()] = usdcAmount;
        curvePool.add_liquidity(amounts, 0);
    }
}
