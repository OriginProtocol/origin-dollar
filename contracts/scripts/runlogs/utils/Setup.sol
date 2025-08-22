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
import { OETHBaseVaultCore } from "contracts/contracts/vault/OETHBaseVaultCore.sol";
import { OETHBaseVaultAdmin } from "contracts/contracts/vault/OETHBaseVaultAdmin.sol";
import { OETHVaultValueChecker } from "contracts/contracts/strategies/VaultValueChecker.sol";

// Contracts - Strategies
import { CurveAMOStrategy } from "contracts/contracts/strategies/CurveAMOStrategy.sol";
import { BaseCurveAMOStrategy } from "contracts/contracts/strategies/BaseCurveAMOStrategy.sol";
import { AerodromeAMOStrategy } from
  "contracts/contracts/strategies/aerodrome/AerodromeAMOStrategy.sol";

// Interfaces
import { IWETH9 } from "contracts/contracts/interfaces/IWETH9.sol";
import { ICurveStableSwapNG } from "contracts/contracts/interfaces/ICurveStableSwapNG.sol";

// Helpers
import { CrossChain, Mainnet, Base } from "./Addresses.sol";
import { Script } from "forge-std/Script.sol";
import { Test } from "forge-std/Test.sol";

// Foundry

abstract contract SetupMainnet is Test, Script {
  // Governance
  address public strategist = CrossChain.STRATEGIST;

  // OUSD
  OUSD public ousd = OUSD(Mainnet.OUSD);

  // OETH
  OETH public oeth = OETH(Mainnet.OETH);
  WOETH public woeth = WOETH(Mainnet.WOETH);
  OETHVaultCore public oethVaultCore = OETHVaultCore(Mainnet.OETH_VAULT);
  OETHVaultAdmin public oethVaultAdmin = OETHVaultAdmin(Mainnet.OETH_VAULT);
  CurveAMOStrategy public oethWethCurveAMO = CurveAMOStrategy(Mainnet.OETH_WETH_CURVE_AMO);
  OETHVaultValueChecker public oethVaultValueChecker =
    OETHVaultValueChecker(Mainnet.OETH_VAULT_VALUE_CHECKER);

  // Interfaces
  IWETH9 public weth = IWETH9(Mainnet.WETH);
  ICurveStableSwapNG public oethWethCurvePool = ICurveStableSwapNG(Mainnet.OETH_WETH_CURVE_POOL);

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
  OETHBaseVaultCore public oethVaultCore = OETHBaseVaultCore(Base.OETHB_VAULT);
  OETHBaseVaultAdmin public oethVaultAdmin = OETHBaseVaultAdmin(Base.OETHB_VAULT);
  BaseCurveAMOStrategy public oethWethCurveAMO = BaseCurveAMOStrategy(Base.OETHB_WETH_CURVE_AMO);
  AerodromeAMOStrategy public oethWethAerodromeAMO =
    AerodromeAMOStrategy(Base.OETHB_WETH_AERODROME_POOL);
  OETHVaultValueChecker public oethVaultValueChecker =
    OETHVaultValueChecker(Base.OETHB_VAULT_VALUE_CHECKER);

  // Interfaces
  IWETH9 public weth = IWETH9(Base.WETH);
  ICurveStableSwapNG public oethWethCurvePool = ICurveStableSwapNG(Base.OETHB_WETH_CURVE_POOL);

  function setUp() public {
    // Note: to ensure perfect simulation, don't fix block number, it will be automatically set to the latest block
    vm.createSelectFork(vm.envString("BASE_PROVIDER_URL"));
  }
}
