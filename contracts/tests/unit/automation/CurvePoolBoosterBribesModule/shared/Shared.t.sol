// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";

// --- Project imports
import {ICurvePoolBoosterBribesModule} from "contracts/interfaces/automation/ICurvePoolBoosterBribesModule.sol";
import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {MockCurvePoolBoosterForBribes} from "tests/mocks/MockCurvePoolBoosterForBribes.sol";

abstract contract Unit_CurvePoolBoosterBribesModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    MockSafeContract internal mockSafe;
    ICurvePoolBoosterBribesModule internal curvePoolBoosterBribesModule;
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

        // Deploy mock pool boosters
        poolBooster1 = address(new MockCurvePoolBoosterForBribes());
        poolBooster2 = address(new MockCurvePoolBoosterForBribes());

        // Deploy CurvePoolBoosterBribesModule with initial pool boosters
        address[] memory initialPoolBoosters = new address[](2);
        initialPoolBoosters[0] = poolBooster1;
        initialPoolBoosters[1] = poolBooster2;

        curvePoolBoosterBribesModule = ICurvePoolBoosterBribesModule(
            vm.deployCode(
                Automation.CURVE_POOL_BOOSTER_BRIBES_MODULE,
                abi.encode(address(mockSafe), operator, initialPoolBoosters, 0.001 ether, 200_000)
            )
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
