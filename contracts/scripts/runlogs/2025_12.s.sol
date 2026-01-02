// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Setup
import { SetupMainnet } from "./utils/Setup.sol";

import { Cluster } from "contracts/contracts/interfaces/ISSVNetwork.sol";
import { Mainnet } from "./utils/Addresses.sol";

// Foundry
import { console } from "forge-std/console.sol";

contract Runlogs_2025_12_Mainnet is SetupMainnet {
    function run() public {
        _2025_12_08();
    }

    // ------------------------------------------------------------------
    // DEC 8, 2025 - Deposit 260 SSV to the second SSV cluster and
    // 75 SSV to the third SSV cluster
    // ------------------------------------------------------------------
    function _2025_12_08() internal {
        vm.startBroadcast(strategist);

        console.log("-----");
        console.log("strategist address", address(strategist));
        console.log("SSV token address", address(ssv));
        console.log("SSV Network address", address(ssvNetwork));

        uint256 ssvDepositAmount = (260 + 75) * 1e18; // 335 SSV

        ssv.approve(address(ssvNetwork), ssvDepositAmount);

        uint64[] memory operatorIds = new uint64[](4);
        operatorIds[0] = 752;
        operatorIds[1] = 753;
        operatorIds[2] = 754;
        operatorIds[3] = 755;

        // Get the SSV Cluster data from the following Hardhat task
        // pnpm hardhat getClusterInfo --operatorids 752,753,754,755 --network mainnet --owner 0x4685dB8bF2Df743c861d71E6cFb5347222992076
        ssvNetwork.deposit(
            Mainnet.NATIVE_STAKING_STRATEGY_2,
            operatorIds,
            260 * 1e18, // 260 SSV,
            Cluster({
                validatorCount: 500,
                networkFeeIndex: 97648369159,
                index: 9585132,
                active: true,
                balance: 1466288969170302776597
            })
        );

        operatorIds[0] = 338;
        operatorIds[1] = 339;
        operatorIds[2] = 340;
        operatorIds[3] = 341;

        // pnpm hardhat getClusterInfo --operatorids 338,339,340,341 --network mainnet --owner 0xE98538A0e8C2871C2482e1Be8cC6bd9F8E8fFD63
        ssvNetwork.deposit(
            Mainnet.NATIVE_STAKING_STRATEGY_3,
            operatorIds,
            75 * 1e18, // 75 SSV,
            Cluster({
                validatorCount: 336,
                networkFeeIndex: 310468171493,
                index: 0,
                active: true,
                balance: 259936411130790000000
            })
        );

        vm.stopBroadcast();
    }
}
