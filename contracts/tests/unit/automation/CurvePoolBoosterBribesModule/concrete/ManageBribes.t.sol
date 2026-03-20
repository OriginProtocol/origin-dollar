// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_CurvePoolBoosterBribesModule_Shared_Test
} from "tests/unit/automation/CurvePoolBoosterBribesModule/shared/Shared.t.sol";

contract Unit_Concrete_CurvePoolBoosterBribesModule_ManageBribes_Test is Unit_CurvePoolBoosterBribesModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- MANAGE BRIBES (DEFAULT)
    //////////////////////////////////////////////////////

    function _allPoolBoosters() internal view returns (address[] memory) {
        address[] memory boosters = new address[](2);
        boosters[0] = poolBooster1;
        boosters[1] = poolBooster2;
        return boosters;
    }

    function test_manageBribes_callsManageCampaignOnAllPoolBoosters() public {
        vm.prank(operator);
        curvePoolBoosterBribesModule.manageBribes(_allPoolBoosters());
    }

    function test_manageBribes_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert();
        curvePoolBoosterBribesModule.manageBribes(_allPoolBoosters());
    }

    function test_manageBribes_RevertWhen_insufficientETH() public {
        // Drain the safe's ETH balance
        vm.deal(address(mockSafe), 0);

        vm.prank(operator);
        vm.expectRevert("Not enough ETH for bridge fees");
        curvePoolBoosterBribesModule.manageBribes(_allPoolBoosters());
    }

    function test_manageBribes_RevertWhen_campaignFails() public {
        // Mock the pool booster to revert on manageCampaign
        vm.mockCallRevert(
            poolBooster1,
            abi.encodeWithSelector(bytes4(keccak256("manageCampaign(uint256,uint8,uint256,uint256)"))),
            "campaign failed"
        );

        vm.prank(operator);
        vm.expectRevert("Manage campaign failed");
        curvePoolBoosterBribesModule.manageBribes(_allPoolBoosters());
    }
}
