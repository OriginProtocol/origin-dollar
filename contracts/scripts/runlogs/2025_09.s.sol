// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Setup
import { SetupBase } from "./utils/Setup.sol";
import { SetupSonic } from "./utils/Setup.sol";
import { SetupMainnet } from "./utils/Setup.sol";

import { CrossChain } from "./utils/Addresses.sol";

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
  function run() public {
    //_2025_09_04();
    //_2025_09_09();
    _2025_11_09();
  }

  // ------------------------------------------------------------------
  // September 04, 2025 - Deposit 160 WETH on Curve AMO
  // ------------------------------------------------------------------
  function _2025_09_04() internal {
    vm.startBroadcast(strategist);
    // Before
    oethVaultCore.rebase();
    oethVaultValueChecker.takeSnapshot();

    // AMO pool before
    uint256 wethPoolBalanceBefore = weth.balanceOf(address(oethWethCurvePool));
    uint256 oethPoolBalanceBefore = oeth.balanceOf(address(oethWethCurvePool));
    uint256 totalPoolBefore = wethPoolBalanceBefore + oethPoolBalanceBefore;
    uint256 wethOutBefore = oethWethCurvePool.get_dy(1, 0, 10 ether);

    console.log("-----");
    console.log("Curve OETH/WETH Pool before");
    console.log("WETH Pool  %18e", wethPoolBalanceBefore);
    console.log("OETH Pool  %18e", oethPoolBalanceBefore);
    console.log("Total Pool %18e", totalPoolBefore);

    // Main action
    uint256 amountToDeposit = 160 ether;
    address[] memory assets = new address[](1);
    assets[0] = address(weth);
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = amountToDeposit;
    oethVaultAdmin.depositToStrategy(address(oethWethCurveAMO), assets, amounts);

    // After
    (uint256 vaultValueAfter, uint256 totalSuplyAfter,) =
      oethVaultValueChecker.snapshots(strategist);
    int256 vaultChange = int256(oethVaultCore.totalValue()) - int256(vaultValueAfter);
    int256 supplyChange = int256(oeth.totalSupply()) - int256(totalSuplyAfter);
    int256 profit = vaultChange - supplyChange;

    oethVaultValueChecker.checkDelta(profit, 1 ether, vaultChange, 10 ether);

    console.log("-----");
    console.log("Profit            : %18e ", profit);
    console.log("OETH Supply change: %18e ", supplyChange);
    console.log("Vault value change: %18e ", vaultChange);

    // AMO pool after
    uint256 wethPoolBalanceAfter = weth.balanceOf(address(oethWethCurvePool));
    uint256 oethPoolBalanceAfter = oeth.balanceOf(address(oethWethCurvePool));
    uint256 totalPoolAfter = wethPoolBalanceAfter + oethPoolBalanceAfter;
    uint256 wethOutAfter = oethWethCurvePool.get_dy(1, 0, 10 ether);

    console.log("-----");
    console.log("Curve OETH/WETH Pool after");
    console.log("WETH Pool  %18e", wethPoolBalanceAfter);
    console.log("OETH Pool  %18e", oethPoolBalanceAfter);
    console.log("Total Pool %18e", totalPoolAfter);
    console.log(
      "Sell 10 OETH Curve prices before and after: %18e || %18e", wethOutBefore, wethOutAfter
    );
    vm.stopBroadcast();
  }

  // ------------------------------------------------------------------
  // September 09, 2025 - Deposit 125 WETH on Curve AMO
  // ------------------------------------------------------------------
  function _2025_09_09() internal {
    vm.startBroadcast(strategist);
    // Before
    oethVaultCore.rebase();
    oethVaultValueChecker.takeSnapshot();

    // AMO pool before
    uint256 wethPoolBalanceBefore = weth.balanceOf(address(oethWethCurvePool));
    uint256 oethPoolBalanceBefore = oeth.balanceOf(address(oethWethCurvePool));
    uint256 totalPoolBefore = wethPoolBalanceBefore + oethPoolBalanceBefore;
    uint256 wethOutBefore = oethWethCurvePool.get_dy(1, 0, 10 ether);

    console.log("-----");
    console.log("Curve OETH/WETH Pool before");
    console.log("WETH Pool  %18e", wethPoolBalanceBefore);
    console.log("OETH Pool  %18e", oethPoolBalanceBefore);
    console.log("Total Pool %18e", totalPoolBefore);

    // Main action
    uint256 amountToDeposit = 125 ether;
    address[] memory assets = new address[](1);
    assets[0] = address(weth);
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = amountToDeposit;
    oethVaultAdmin.depositToStrategy(address(oethWethCurveAMO), assets, amounts);

    // After
    (uint256 vaultValueAfter, uint256 totalSuplyAfter,) =
      oethVaultValueChecker.snapshots(strategist);
    int256 vaultChange = int256(oethVaultCore.totalValue()) - int256(vaultValueAfter);
    int256 supplyChange = int256(oeth.totalSupply()) - int256(totalSuplyAfter);
    int256 profit = vaultChange - supplyChange;

    oethVaultValueChecker.checkDelta(profit, 1 ether, vaultChange, 10 ether);

    console.log("-----");
    console.log("Profit            : %18e ", profit);
    console.log("OETH Supply change: %18e ", supplyChange);
    console.log("Vault value change: %18e ", vaultChange);

    // AMO pool after
    uint256 wethPoolBalanceAfter = weth.balanceOf(address(oethWethCurvePool));
    uint256 oethPoolBalanceAfter = oeth.balanceOf(address(oethWethCurvePool));
    uint256 totalPoolAfter = wethPoolBalanceAfter + oethPoolBalanceAfter;
    uint256 wethOutAfter = oethWethCurvePool.get_dy(1, 0, 10 ether);

    console.log("-----");
    console.log("Curve OETH/WETH Pool after");
    console.log("WETH Pool  %18e", wethPoolBalanceAfter);
    console.log("OETH Pool  %18e", oethPoolBalanceAfter);
    console.log("Total Pool %18e", totalPoolAfter);
    console.log(
      "Sell 10 OETH Curve prices before and after: %18e || %18e", wethOutBefore, wethOutAfter
    );
    vm.stopBroadcast();
  }

  // ------------------------------------------------------------------
  // September 11, 2025 - Deploy Merkl Pool Booster + Yield Forward
  // ------------------------------------------------------------------
  function _2025_11_09() internal {
    bytes memory campaignData =
      "0x67a66cbacb2fe48ec4326932d4528215ad11656a86135f2795f5b90e501eb53800000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

    vm.startBroadcast(strategist);
    // Create the pool booster
    poolBoosterFactoryMerkl.createPoolBoosterMerkl({
      _campaignType: 1,
      _ammPoolAddress: CrossChain.MORPHO_BLUE,
      _campaignDuration: 1 days,
      campaignData: campaignData,
      _salt: uint256(keccak256(abi.encodePacked(block.timestamp)))
    });

    uint256 length = poolBoosterFactoryMerkl.poolBoosterLength();
    (address pb,,) = poolBoosterFactoryMerkl.poolBoosters(length - 1);

    // Run yield forward
    oeth.delegateYield(CrossChain.MORPHO_BLUE, address(pb));
    vm.stopBroadcast();
  }
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
