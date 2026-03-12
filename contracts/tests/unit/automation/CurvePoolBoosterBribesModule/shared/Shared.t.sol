// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {CurvePoolBoosterBribesModule} from "contracts/automation/CurvePoolBoosterBribesModule.sol";

abstract contract Unit_CurvePoolBoosterBribesModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    address internal poolBooster1;
    address internal poolBooster2;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        label();
    }

    function _deployContracts() internal {
        // Deploy mock safe
        mockSafe = new MockSafeContract();

        // Create pool booster addresses
        poolBooster1 = makeAddr("PoolBooster1");
        poolBooster2 = makeAddr("PoolBooster2");

        // Deploy CurvePoolBoosterBribesModule with initial pool boosters
        address[] memory initialPoolBoosters = new address[](2);
        initialPoolBoosters[0] = poolBooster1;
        initialPoolBoosters[1] = poolBooster2;

        curvePoolBoosterBribesModule = new CurvePoolBoosterBribesModule(
            address(mockSafe),
            operator,
            initialPoolBoosters,
            0.001 ether, // bridgeFee
            200_000 // additionalGasLimit
        );

        // Fund the safe with ETH to cover bridge fees
        vm.deal(address(mockSafe), 1 ether);
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(poolBooster1, "PoolBooster1");
        vm.label(poolBooster2, "PoolBooster2");
        vm.label(address(curvePoolBoosterBribesModule), "CurvePoolBoosterBribesModule");
    }
}
