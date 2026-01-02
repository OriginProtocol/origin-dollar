// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Contracts - OUSD
import { OUSD } from "contracts/contracts/token/OUSD.sol";

// Contracts - OETH
import { OETH } from "contracts/contracts/token/OETH.sol";
import { WOETH } from "contracts/contracts/token/WOETH.sol";
import { OETHBase } from "contracts/contracts/token/OETHBase.sol";
import { WOETHBase } from "contracts/contracts/token/WOETHBase.sol";
import { OETHVaultCore } from "contracts/contracts/vault/OETHVaultCore.sol";
import { OETHVaultAdmin } from "contracts/contracts/vault/OETHVaultAdmin.sol";
import { OSonicVaultCore } from "contracts/contracts/vault/OSonicVaultCore.sol";
import {
    OSonicVaultAdmin
} from "contracts/contracts/vault/OSonicVaultAdmin.sol";
import {
    OETHBaseVaultCore
} from "contracts/contracts/vault/OETHBaseVaultCore.sol";
import {
    OETHBaseVaultAdmin
} from "contracts/contracts/vault/OETHBaseVaultAdmin.sol";
import {
    OETHVaultValueChecker
} from "contracts/contracts/strategies/VaultValueChecker.sol";

// Contract - OS
import { OSonic } from "contracts/contracts/token/OSonic.sol";

// Contracts - Strategies
import {
    CurveAMOStrategy
} from "contracts/contracts/strategies/CurveAMOStrategy.sol";
import {
    BaseCurveAMOStrategy
} from "contracts/contracts/strategies/BaseCurveAMOStrategy.sol";
import {
    SonicStakingStrategy
} from "contracts/contracts/strategies/sonic/SonicStakingStrategy.sol";
import {
    AerodromeAMOStrategy
} from "contracts/contracts/strategies/aerodrome/AerodromeAMOStrategy.sol";

// Contracts - ARM
import { IARM } from "contracts/contracts/interfaces/arm/IARM.sol";

// Contracts - Pool Booster
import {
    PoolBoosterFactoryMerkl
} from "contracts/contracts/poolBooster/PoolBoosterFactoryMerkl.sol";
import {
    PoolBoostCentralRegistry
} from "contracts/contracts/poolBooster/PoolBoostCentralRegistry.sol";

// Interfaces
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IWETH9 } from "contracts/contracts/interfaces/IWETH9.sol";
import {
    ICurveStableSwapNG
} from "contracts/contracts/interfaces/ICurveStableSwapNG.sol";
import { ISSVNetwork } from "contracts/contracts/interfaces/ISSVNetwork.sol";

// Helpers
import { CrossChain, Mainnet, Base, Sonic } from "./Addresses.sol";

// Foundry
import { Script } from "forge-std/Script.sol";
import { Test } from "forge-std/Test.sol";

abstract contract SetupMainnet is Test, Script {
    // Governance
    address public strategist = CrossChain.STRATEGIST;
    address public treasury = Mainnet.TREASURY;

    // OUSD
    OUSD public ousd = OUSD(Mainnet.OUSD);

    // OETH
    OETH public oeth = OETH(Mainnet.OETH);
    WOETH public woeth = WOETH(Mainnet.WOETH);
    OETHVaultCore public oethVaultCore = OETHVaultCore(Mainnet.OETH_VAULT);
    OETHVaultAdmin public oethVaultAdmin = OETHVaultAdmin(Mainnet.OETH_VAULT);
    CurveAMOStrategy public oethWethCurveAMO =
        CurveAMOStrategy(Mainnet.OETH_WETH_CURVE_AMO);
    OETHVaultValueChecker public oethVaultValueChecker =
        OETHVaultValueChecker(Mainnet.OETH_VAULT_VALUE_CHECKER);

    // Pool Booster
    PoolBoosterFactoryMerkl public poolBoosterFactoryMerkl =
        PoolBoosterFactoryMerkl(Mainnet.POOL_BOOSTER_FACTORY_MERKL);
    PoolBoostCentralRegistry public poolBoosterCentralRegistry =
        PoolBoostCentralRegistry(Mainnet.POOL_BOOSTER_CENTRAL_REGISTRY);

    // Interfaces
    IWETH9 public weth = IWETH9(Mainnet.WETH);
    ICurveStableSwapNG public oethWethCurvePool =
        ICurveStableSwapNG(Mainnet.OETH_WETH_CURVE_POOL);
    IARM public etherfiARM = IARM(Mainnet.ETHERFI_ARM);

    IERC20 public ssv = IERC20(Mainnet.SSV);
    ISSVNetwork public ssvNetwork = ISSVNetwork(Mainnet.SSV_NETWORK);

    function setUp() public {
        // Note: to ensure perfect simulation, don't fix block number, it will be automatically set to the latest block
        vm.createSelectFork(vm.envString("PROVIDER_URL"));
    }
}

abstract contract SetupBase is Test, Script {
    // Governance
    address public strategist = CrossChain.STRATEGIST;

    // OETH
    OETHBase public oeth = OETHBase(Base.OETHB);
    WOETHBase public woeth = WOETHBase(Base.WOETHB);
    OETHBaseVaultCore public oethVaultCore =
        OETHBaseVaultCore(Base.OETHB_VAULT);
    OETHBaseVaultAdmin public oethVaultAdmin =
        OETHBaseVaultAdmin(Base.OETHB_VAULT);
    BaseCurveAMOStrategy public oethWethCurveAMO =
        BaseCurveAMOStrategy(Base.OETHB_WETH_CURVE_AMO);
    AerodromeAMOStrategy public oethWethAerodromeAMO =
        AerodromeAMOStrategy(Base.OETHB_WETH_AERODROME_POOL);
    OETHVaultValueChecker public oethVaultValueChecker =
        OETHVaultValueChecker(Base.OETHB_VAULT_VALUE_CHECKER);

    // Pool Booster
    PoolBoosterFactoryMerkl public poolBoosterFactoryMerkl =
        PoolBoosterFactoryMerkl(Base.POOL_BOOSTER_FACTORY_MERKL);
    PoolBoostCentralRegistry public poolBoosterCentralRegistry =
        PoolBoostCentralRegistry(Base.POOL_BOOSTER_CENTRAL_REGISTRY);

    // Interfaces
    IWETH9 public weth = IWETH9(Base.WETH);
    ICurveStableSwapNG public oethWethCurvePool =
        ICurveStableSwapNG(Base.OETHB_WETH_CURVE_POOL);

    function setUp() public {
        // Note: to ensure perfect simulation, don't fix block number, it will be automatically set to the latest block
        vm.createSelectFork(vm.envString("BASE_PROVIDER_URL"));
    }
}

abstract contract SetupSonic is Test, Script {
    // Governance
    address public governor = Sonic.GOVERNOR;
    address public timelock = Sonic.TIMELOCK;
    address public strategist = CrossChain.STRATEGIST;
    address public localStrategist = Sonic.STRATEGIST;

    // OS
    OSonic public os = OSonic(Sonic.OS);
    OSonicVaultCore public osVaultCore = OSonicVaultCore(Sonic.OS_VAULT);
    OSonicVaultAdmin public osVaultAdmin = OSonicVaultAdmin(Sonic.OS_VAULT);
    OETHVaultValueChecker public osVaultValueChecker =
        OETHVaultValueChecker(Sonic.OS_VAULT_VALUE_CHECKER);

    // Interfaces
    IWETH9 public ws = IWETH9(Sonic.WS);

    // ARM
    IARM public arm = IARM(Sonic.ARM);

    // Staking strategy
    SonicStakingStrategy public stakingStrategy =
        SonicStakingStrategy(payable(Sonic.STAKING_STRATEGY));

    function setUp() public {
        // Note: to ensure perfect simulation, don't fix block number, it will be automatically set to the latest block
        vm.createSelectFork(vm.envString("SONIC_PROVIDER_URL"));
    }
}
