// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_CurvePoolBooster_Shared_Test} from "tests/fork/mainnet/poolBooster/CurvePoolBooster/shared/Shared.t.sol";

import {CrossChain} from "tests/utils/Addresses.sol";

contract Fork_Concrete_CurvePoolBooster_ManageCampaign_Test is Fork_CurvePoolBooster_Shared_Test {
    function test_manageCampaign_totalRewards() public {
        _dealOUSDAndCreateCampaign();

        // Deal new OUSD to pool booster
        _dealOUSD(address(curvePoolBoosterPlain), 13 ether);
        assertEq(ousdToken.balanceOf(address(curvePoolBoosterPlain)), 13 ether);

        vm.startPrank(CrossChain.multichainStrategist);
        curvePoolBoosterPlain.setCampaignId(12);

        // manageCampaign(totalRewardAmount, numberOfPeriods, maxRewardPerVote, additionalGasLimit)
        // Use type(uint256).max to send all tokens
        curvePoolBoosterPlain.manageCampaign{value: 0.1 ether}(type(uint256).max, 0, 0, 0);
        vm.stopPrank();

        assertEq(ousdToken.balanceOf(address(curvePoolBoosterPlain)), 0);
    }

    function test_manageCampaign_numberOfPeriods() public {
        _dealOUSDAndCreateCampaign();

        vm.startPrank(CrossChain.multichainStrategist);
        curvePoolBoosterPlain.setCampaignId(12);

        // manageCampaign(totalRewardAmount, numberOfPeriods, maxRewardPerVote, additionalGasLimit)
        curvePoolBoosterPlain.manageCampaign{value: 0.1 ether}(0, 2, 0, 0);
        vm.stopPrank();
    }

    function test_manageCampaign_rewardPerVoter() public {
        _dealOUSDAndCreateCampaign();

        vm.startPrank(CrossChain.multichainStrategist);
        curvePoolBoosterPlain.setCampaignId(12);

        // manageCampaign(totalRewardAmount, numberOfPeriods, maxRewardPerVote, additionalGasLimit)
        curvePoolBoosterPlain.manageCampaign{value: 0.1 ether}(0, 0, 100, 0);
        vm.stopPrank();
    }
}
