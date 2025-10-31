// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Setup
import { SetupBase } from "./utils/Setup.sol";
import { SetupSonic } from "./utils/Setup.sol";
import { SetupMainnet } from "./utils/Setup.sol";

import { CrossChain } from "./utils/Addresses.sol";

// Foundry
import { console } from "forge-std/console.sol";

contract Runlogs_2025_10_Mainnet is SetupMainnet {
  function run() public {
    //_2025_10_01();
    //_2025_10_02();
    _2025_10_30();
  }

  // ------------------------------------------------------------------
  // Oct 3, 2025 - Yield Forward to Computed Merkl Pool Booster
  // ------------------------------------------------------------------
  function _2025_10_01() internal {
    bytes memory campaignData =
      hex"b8fef900b383db2dbbf4458c7f46acf5b140f26d603a6d1829963f241b82510e00000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

    vm.startBroadcast(strategist);

    console.log("-----");
    console.log("strategist address", address(strategist));
    console.log("poolBoosterFactoryMerkl address", address(poolBoosterFactoryMerkl));

    address poolBoosterAddress = poolBoosterFactoryMerkl.computePoolBoosterAddress({
      _campaignType: 45,
      _ammPoolAddress: CrossChain.MORPHO_BLUE,
      _campaignDuration: 7 days,
      campaignData: campaignData,
      _salt: uint256(keccak256(abi.encodePacked("Merkl Morpho PB OETH/USDC v1")))
    });

    console.log("computed address", poolBoosterAddress);

    // Run yield forward
    oeth.delegateYield(CrossChain.MORPHO_BLUE, poolBoosterAddress);
    vm.stopBroadcast();
  }

  // ------------------------------------------------------------------
  // Oct 3+ TODO, 2025 - Create Merkl Pool Booster once Central Registry governance passes
  // ------------------------------------------------------------------
  function _2025_10_02() internal {
    bytes memory campaignData =
      hex"b8fef900b383db2dbbf4458c7f46acf5b140f26d603a6d1829963f241b82510e00000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

    vm.startBroadcast(strategist);
    // Create the pool booster
    poolBoosterFactoryMerkl.createPoolBoosterMerkl({
      _campaignType: 45, // Incentivise Borrow rate of OETH/USDC
      _ammPoolAddress: CrossChain.MORPHO_BLUE,
      _campaignDuration: 7 days,
      campaignData: campaignData,
      _salt: uint256(keccak256(abi.encodePacked("Merkl Morpho PB OETH/USDC v1")))
    });

    vm.stopBroadcast();
  }

  function _2025_10_30() internal {
    // Amount to deposit into Etherfi ARM
    uint256 amountToDeposit = 10 ether;

    vm.startBroadcast(treasury);
    // Approve Etherfi ARM to pull WETH
    weth.approve(address(etherfiARM), amountToDeposit);

    // Deposit WETH into Etherfi ARM
    etherfiARM.deposit(amountToDeposit);
    vm.stopBroadcast();
  }
}
