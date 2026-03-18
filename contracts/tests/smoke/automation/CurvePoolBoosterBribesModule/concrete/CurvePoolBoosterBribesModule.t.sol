// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Smoke_CurvePoolBoosterBribesModule_Shared_Test} from
    "tests/smoke/automation/CurvePoolBoosterBribesModule/shared/Shared.t.sol";

contract Smoke_Concrete_CurvePoolBoosterBribesModule_Test is
    Smoke_CurvePoolBoosterBribesModule_Shared_Test
{
    function test_safeContract() public view {
        assertNotEq(address(curvePoolBoosterBribesModule.safeContract()), address(0));
    }

    function test_bridgeFee() public view {
        uint256 fee = curvePoolBoosterBribesModule.bridgeFee();
        assertLe(fee, 0.01 ether);
    }

    function test_additionalGasLimit() public view {
        uint256 gasLimit = curvePoolBoosterBribesModule.additionalGasLimit();
        assertLe(gasLimit, 10_000_000);
    }

    function test_getPoolBoosters() public view {
        address[] memory poolBoosters = curvePoolBoosterBribesModule.getPoolBoosters();
        assertGt(poolBoosters.length, 0);
    }

    // TODO: The deployed contract at CURVE_POOL_BOOSTER_BRIBES_MODULE is an older version
    // that predates the manageBribes() function added in this branch. Re-enable once
    // main is merged and the module is redeployed with the updated ABI.
    // function test_manageBribes() public { ... }
}
