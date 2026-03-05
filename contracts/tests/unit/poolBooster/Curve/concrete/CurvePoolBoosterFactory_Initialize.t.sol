// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";
import {CurvePoolBoosterFactory} from "contracts/poolBooster/curve/CurvePoolBoosterFactory.sol";

contract Unit_Concrete_CurvePoolBoosterFactory_Initialize_Test is Unit_Curve_Shared_Test {
    function test_initialize() public view {
        assertEq(curvePoolBoosterFactory.governor(), governor);
        assertEq(curvePoolBoosterFactory.strategistAddr(), strategist);
        assertEq(address(curvePoolBoosterFactory.centralRegistry()), address(centralRegistry));
    }

    function test_initialize_RevertWhen_doubleInit() public {
        // curvePoolBoosterFactory is already initialized in shared setUp
        vm.expectRevert("Initializable: contract is already initialized");
        curvePoolBoosterFactory.initialize(governor, strategist, address(centralRegistry));
    }
}
