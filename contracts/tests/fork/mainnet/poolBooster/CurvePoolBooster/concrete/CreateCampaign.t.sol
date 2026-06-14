// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Fork_CurvePoolBooster_Shared_Test} from "tests/fork/mainnet/poolBooster/CurvePoolBooster/shared/Shared.t.sol";

// --- Test utilities
import {CrossChain} from "tests/utils/Addresses.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

contract Fork_Concrete_CurvePoolBooster_CreateCampaign_Test is Fork_CurvePoolBooster_Shared_Test {
    function test_createCampaign() public {
        _dealOUSDAndCreateCampaign();

        // All OUSD should have been sent to the CampaignRemoteManager
        assertEq(ousdToken.balanceOf(address(curvePoolBoosterPlain)), 0);
    }

    function test_createCampaign_withFee() public {
        // Set fee (10%) and fee collector
        vm.startPrank(Mainnet.Timelock);
        curvePoolBoosterPlain.setFee(1000);
        curvePoolBoosterPlain.setFeeCollector(josh);
        vm.stopPrank();

        assertEq(ousdToken.balanceOf(josh), 0);

        _dealOUSDAndCreateCampaign();

        // Fee collector should have received ~1 OUSD (10% of 10)
        assertGe(ousdToken.balanceOf(josh), 1 ether);
    }

    function test_createCampaign_afterClose() public {
        // Set a campaign id and close it
        vm.startPrank(CrossChain.multichainStrategist);
        curvePoolBoosterPlain.setCampaignId(12);
        curvePoolBoosterPlain.closeCampaign{value: 0.1 ether}(12, 0);
        vm.stopPrank();

        // Campaign id should be reset to 0
        assertEq(curvePoolBoosterPlain.campaignId(), 0);

        // Should be able to create another campaign
        _dealOUSDAndCreateCampaign();
    }
}
