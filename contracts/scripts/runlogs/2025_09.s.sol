// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Setup
import { SetupBase } from "./utils/Setup.sol";
import { SetupSonic } from "./utils/Setup.sol";
import { SetupMainnet } from "./utils/Setup.sol";

import { Sonic } from "./utils/Addresses.sol";

// Foundry
import { console } from "forge-std/console.sol";

contract Runlogs_2025_09_Mainnet is SetupMainnet {
  function run() public {
    _2025_09_03();
  }

  function _2025_09_03() internal {
    vm.startBroadcast(strategist);

    oethVaultCore.rebase();
    oethVaultValueChecker.takeSnapshot();

    address[] memory assets = new address[](1);
    assets[0] = address(weth);
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = 7 ether;
    oethVaultAdmin.withdrawFromStrategy(address(oethWethCurveAMO), assets, amounts);

    (uint256 vaultValueAfter, uint256 totalSupplyAfter,) =
      oethVaultValueChecker.snapshots(strategist);
    int256 vaultChange = int256(oethVaultCore.totalValue()) - int256(vaultValueAfter);
    int256 supplyChange = int256(oeth.totalSupply()) - int256(totalSupplyAfter);
    int256 profit = vaultChange - supplyChange;
    oethVaultValueChecker.checkDelta(profit, 0.1 ether, vaultChange, 1 ether);

    console.log("-----");
    console.log("Profit             : %18e", profit);
    console.log("Amount withdrawn   : %18e", amounts[0], "ether");
    console.log("Supply change      : %18e", supplyChange);
    console.log("Vault value change : %18e", vaultChange);


    vm.stopBroadcast();
  }
}

contract Runlogs_2025_09_Base is SetupBase {
  function run() public { }
}

contract Runlogs_2025_09_Sonic is SetupSonic {
  function run() public {
    //_2025_09_01();
    _2025_09_01_BIS();
  }

  function _2025_09_01() internal {
    vm.startBroadcast(localStrategist);
    address[] memory tokens = new address[](1);
    tokens[0] = address(ws);
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = 2_644_097 ether;

    // Before
    osVaultCore.rebase();
    osVaultValueChecker.takeSnapshot();

    // Main
    osVaultAdmin.depositToStrategy(address(stakingStrategy), tokens, amounts);

    // After
    (uint256 vaultValueAfter, uint256 totalSupplyAfter,) =
      osVaultValueChecker.snapshots(localStrategist);
    int256 vaultChange = int256(osVaultCore.totalValue()) - int256(vaultValueAfter);
    int256 supplyChange = int256(os.totalSupply()) - int256(totalSupplyAfter);
    int256 profit = vaultChange - supplyChange;
    osVaultValueChecker.checkDelta(profit, 10 ether, vaultChange, 10 ether);

    console.log("-----");
    console.log("Profit            : %18e", profit);
    console.log("Amount deposited  : %18e", amounts[0], "ether");
    console.log("OS Supply change  : %18e", supplyChange);
    console.log("Vault value change: %18e", vaultChange);

    vm.stopBroadcast();
  }

  function _2025_09_01_BIS() internal {
    vm.startBroadcast(timelock);
    osVaultAdmin.setAssetDefaultStrategy(address(ws), address(stakingStrategy));
    vm.stopBroadcast();
  }
}
