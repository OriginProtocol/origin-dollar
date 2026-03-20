// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_CurvePoolBooster_Shared_Test} from "tests/fork/poolBooster/CurvePoolBooster/shared/Shared.t.sol";

import {CrossChain} from "tests/utils/Addresses.sol";

contract Fork_Concrete_CurvePoolBooster_CloseCampaign_Test is Fork_CurvePoolBooster_Shared_Test {
    function test_closeCampaign() public {
        _dealOUSDAndCreateCampaign();

        vm.prank(CrossChain.multichainStrategist);
        curvePoolBoosterPlain.closeCampaign{value: 0.1 ether}(12, 0);
    }
}
