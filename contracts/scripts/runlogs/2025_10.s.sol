// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Setup
import { SetupBase } from "./utils/Setup.sol";
import { SetupSonic } from "./utils/Setup.sol";
import { SetupMainnet } from "./utils/Setup.sol";

import { CrossChain } from "./utils/Addresses.sol";

import { Cluster } from "contracts/contracts/interfaces/ISSVNetwork.sol";
import { Mainnet } from "./utils/Addresses.sol";

// Foundry
import { console } from "forge-std/console.sol";

contract Runlogs_2025_10_Mainnet is SetupMainnet {
    function run() public {
        // _2025_10_01();
        //_2025_10_02();
        _2025_10_07();
    }

    // ------------------------------------------------------------------
    // Oct 3, 2025 - Yield Forward to Computed Merkl Pool Booster
    // ------------------------------------------------------------------
    function _2025_10_01() internal {
        bytes
            memory campaignData = hex"b8fef900b383db2dbbf4458c7f46acf5b140f26d603a6d1829963f241b82510e00000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

        vm.startBroadcast(strategist);

        console.log("-----");
        console.log("strategist address", address(strategist));
        console.log(
            "poolBoosterFactoryMerkl address",
            address(poolBoosterFactoryMerkl)
        );

        address poolBoosterAddress = poolBoosterFactoryMerkl
            .computePoolBoosterAddress({
                _campaignType: 45,
                _ammPoolAddress: CrossChain.MORPHO_BLUE,
                _campaignDuration: 7 days,
                campaignData: campaignData,
                _salt: uint256(
                    keccak256(abi.encodePacked("Merkl Morpho PB OETH/USDC v1"))
                )
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
        bytes
            memory campaignData = hex"b8fef900b383db2dbbf4458c7f46acf5b140f26d603a6d1829963f241b82510e00000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

        vm.startBroadcast(strategist);
        // Create the pool booster
        poolBoosterFactoryMerkl.createPoolBoosterMerkl({
            _campaignType: 45, // Incentivise Borrow rate of OETH/USDC
            _ammPoolAddress: CrossChain.MORPHO_BLUE,
            _campaignDuration: 7 days,
            campaignData: campaignData,
            _salt: uint256(
                keccak256(abi.encodePacked("Merkl Morpho PB OETH/USDC v1"))
            )
        });

        vm.stopBroadcast();
    }

    // ------------------------------------------------------------------
    // Oct 7, 2025 - Deposit 400 SSV to the second SSV cluster and
    // 200 SSV to the third SSV cluster
    // ------------------------------------------------------------------
    function _2025_10_07() internal {
        vm.startBroadcast(strategist);

        console.log("-----");
        console.log("strategist address", address(strategist));
        console.log("SSV token address", address(ssv));
        console.log("SSV Network address", address(ssvNetwork));

        uint256 ssvDepositAmount = 600 * 1e18; // 600 SSV

        ssv.approve(address(ssvNetwork), ssvDepositAmount);

        uint64[] memory operatorIds = new uint64[](4);
        operatorIds[0] = 752;
        operatorIds[1] = 753;
        operatorIds[2] = 754;
        operatorIds[3] = 755;

        // Get the SSV Cluster data from the following Hardhat task
        // npx hardhat getClusterInfo --operatorids 752,753,754,755 --network mainnet --owner 0x4685dB8bF2Df743c861d71E6cFb5347222992076
        ssvNetwork.deposit(
            Mainnet.NATIVE_STAKING_STRATEGY_2,
            operatorIds,
            400 * 1e18, // 400 SSV,
            Cluster({
                validatorCount: 500,
                networkFeeIndex: 97648369159,
                index: 9585132,
                active: true,
                balance: 1066288969170302776597
            })
        );

        operatorIds[0] = 338;
        operatorIds[1] = 339;
        operatorIds[2] = 340;
        operatorIds[3] = 341;

        // npx hardhat getClusterInfo --operatorids 338,339,340,341 --network mainnet --owner 0xE98538A0e8C2871C2482e1Be8cC6bd9F8E8fFD63
        ssvNetwork.deposit(
            Mainnet.NATIVE_STAKING_STRATEGY_3,
            operatorIds,
            200 * 1e18, // 200 SSV,
            Cluster({
                validatorCount: 436,
                networkFeeIndex: 226592732593,
                index: 0,
                active: true,
                balance: 419059922731900000000
            })
        );

        vm.stopBroadcast();
    }
}
