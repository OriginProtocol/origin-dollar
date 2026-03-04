// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.sol";
import {CurvePoolBooster} from "contracts/poolBooster/curve/CurvePoolBooster.sol";
import {CurvePoolBoosterPlain} from "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol";
import {ICampaignRemoteManager} from "contracts/interfaces/ICampaignRemoteManager.sol";

contract Unit_Concrete_CurvePoolBooster_Receive_Test is Unit_Curve_Shared_Test {
    function test_receive() public {
        uint256 balanceBefore = address(curvePoolBoosterPlain).balance;

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool success,) = address(curvePoolBoosterPlain).call{value: 1 ether}("");
        assertTrue(success);

        assertEq(address(curvePoolBoosterPlain).balance, balanceBefore + 1 ether);
    }
}
