// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CurvePoolBoosterBribesModule_Shared_Test
} from "tests/unit/automation/CurvePoolBoosterBribesModule/shared/Shared.t.sol";

contract Unit_Concrete_CurvePoolBoosterBribesModule_ManageBribesCustom_Test is
    Unit_CurvePoolBoosterBribesModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- MANAGE BRIBES (CUSTOM PARAMS)
    //////////////////////////////////////////////////////

    function _allPoolBoosters() internal view returns (address[] memory) {
        address[] memory boosters = new address[](2);
        boosters[0] = poolBooster1;
        boosters[1] = poolBooster2;
        return boosters;
    }

    function test_manageBribesCustom_callsWithCustomParams() public {
        uint256[] memory totalRewardAmounts = new uint256[](2);
        totalRewardAmounts[0] = 1000 ether;
        totalRewardAmounts[1] = 2000 ether;

        uint8[] memory extraDuration = new uint8[](2);
        extraDuration[0] = 2;
        extraDuration[1] = 3;

        uint256[] memory rewardsPerVote = new uint256[](2);
        rewardsPerVote[0] = 0.5 ether;
        rewardsPerVote[1] = 1 ether;

        vm.prank(operator);
        curvePoolBoosterBribesModule.manageBribes(_allPoolBoosters(), totalRewardAmounts, extraDuration, rewardsPerVote);
    }

    function test_manageBribesCustom_RevertWhen_totalRewardAmountsLengthMismatch() public {
        uint256[] memory totalRewardAmounts = new uint256[](1); // wrong length
        uint8[] memory extraDuration = new uint8[](2);
        uint256[] memory rewardsPerVote = new uint256[](2);

        vm.prank(operator);
        vm.expectRevert("Length mismatch");
        curvePoolBoosterBribesModule.manageBribes(_allPoolBoosters(), totalRewardAmounts, extraDuration, rewardsPerVote);
    }

    function test_manageBribesCustom_RevertWhen_extraDurationLengthMismatch() public {
        uint256[] memory totalRewardAmounts = new uint256[](2);
        uint8[] memory extraDuration = new uint8[](1); // wrong length
        uint256[] memory rewardsPerVote = new uint256[](2);

        vm.prank(operator);
        vm.expectRevert("Length mismatch");
        curvePoolBoosterBribesModule.manageBribes(_allPoolBoosters(), totalRewardAmounts, extraDuration, rewardsPerVote);
    }

    function test_manageBribesCustom_RevertWhen_rewardsPerVoteLengthMismatch() public {
        uint256[] memory totalRewardAmounts = new uint256[](2);
        uint8[] memory extraDuration = new uint8[](2);
        uint256[] memory rewardsPerVote = new uint256[](1); // wrong length

        vm.prank(operator);
        vm.expectRevert("Length mismatch");
        curvePoolBoosterBribesModule.manageBribes(_allPoolBoosters(), totalRewardAmounts, extraDuration, rewardsPerVote);
    }

    function test_manageBribesCustom_RevertWhen_notOperator() public {
        uint256[] memory totalRewardAmounts = new uint256[](2);
        uint8[] memory extraDuration = new uint8[](2);
        uint256[] memory rewardsPerVote = new uint256[](2);

        vm.prank(josh);
        vm.expectRevert();
        curvePoolBoosterBribesModule.manageBribes(_allPoolBoosters(), totalRewardAmounts, extraDuration, rewardsPerVote);
    }
}
