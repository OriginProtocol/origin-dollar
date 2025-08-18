// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Setup
import { SetupBase } from "./utils/Setup.sol";
import { SetupMainnet } from "./utils/Setup.sol";

// Foundry
import { console } from "forge-std/console.sol";

contract Runlogs_2025_08_Mainnet is SetupMainnet {
  function run() public {
    _2025_08_04();
  }

  // ------------------------------------------------------------------
  // July 28, 2025 - Withdraw 2335 WETH from new Curve AMO
  // ------------------------------------------------------------------
  function _2025_08_04() internal {
    vm.startBroadcast(strategist);
    // Before
    oethVaultCore.rebase();
    oethVaultValueChecker.takeSnapshot();

    // AMO pool before
    uint256 wethPoolBalanceBefore = weth.balanceOf(address(oethWethCurvePool));
    uint256 oethPoolBalanceBefore = oeth.balanceOf(address(oethWethCurvePool));
    uint256 totalPoolBefore = wethPoolBalanceBefore + oethPoolBalanceBefore;
    uint256 wethOutBefore = oethWethCurvePool.get_dy(0, 1, 10 ether);

    console.log("-----");
    console.log("Curve OETH/WETH Pool before");
    console.log("WETH Pool  %18e", wethPoolBalanceBefore);
    console.log("OETH Pool  %18e", oethPoolBalanceBefore);
    console.log("Total Pool %18e", totalPoolBefore);

    // Main action
    uint256 amountToWithdraw = 1_000 ether;
    address[] memory assets = new address[](1);
    assets[0] = address(weth);
    uint256[] memory amounts = new uint256[](1);
    amounts[0] = amountToWithdraw;
    oethVaultAdmin.withdrawFromStrategy(address(oethWethCurveAMO), assets, amounts);

    // After
    (uint256 vaultValueAfter, uint256 totalSuplyAfter,) =
      oethVaultValueChecker.snapshots(strategist);
    int256 vaultChange = int256(oethVaultCore.totalValue()) - int256(vaultValueAfter);
    int256 supplyChange = int256(oeth.totalSupply()) - int256(totalSuplyAfter);
    int256 profit = vaultChange - supplyChange;

    oethVaultValueChecker.checkDelta(profit, 1 ether, vaultChange, 10 ether);

    console.log("-----");
    console.log("Profit            : %18e", profit);
    console.log("OETH Supply change: %18e", supplyChange);
    console.log("Vault value change: %18e", vaultChange);

    // AMO pool after
    uint256 wethPoolBalanceAfter = weth.balanceOf(address(oethWethCurvePool));
    uint256 oethPoolBalanceAfter = oeth.balanceOf(address(oethWethCurvePool));
    uint256 totalPoolAfter = wethPoolBalanceAfter + oethPoolBalanceAfter;
    uint256 wethOutAfter = oethWethCurvePool.get_dy(0, 1, 10 ether);

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
}

contract Runlogs_2025_08_Base is SetupBase {
  function run() public {
    _2025_08_18();
  }

  // ------------------------------------------------------------------
  // August 18, 2025 - Deposit 90 WETH on Curve AMO
  // ------------------------------------------------------------------
  function _2025_08_18() internal {
    vm.startBroadcast(strategist);
    // Before
    oethVaultCore.rebase();
    oethVaultValueChecker.takeSnapshot();

    // AMO pool before
    uint256 wethPoolBalanceBefore = weth.balanceOf(address(oethWethCurvePool));
    uint256 oethPoolBalanceBefore = oeth.balanceOf(address(oethWethCurvePool));
    uint256 totalPoolBefore = wethPoolBalanceBefore + oethPoolBalanceBefore;
    uint256 wethOutBefore = oethWethCurvePool.get_dy(0, 1, 10 ether);

    console.log("-----");
    console.log("Curve OETH/WETH Pool before");
    console.log("WETH Pool  %18e", wethPoolBalanceBefore);
    console.log("OETH Pool  %18e", oethPoolBalanceBefore);
    console.log("Total Pool %18e", totalPoolBefore);

    // Main action
    uint256 amountToDeposit = 90 ether;
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
    uint256 wethOutAfter = oethWethCurvePool.get_dy(0, 1, 10 ether);

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
}
