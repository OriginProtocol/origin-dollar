// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CurvePoolBoosterBribesModule_Shared_Test
} from "tests/unit/automation/CurvePoolBoosterBribesModule/shared/Shared.t.sol";
import {MockCurvePoolBoosterForBribes} from "tests/mocks/MockCurvePoolBoosterForBribes.sol";

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

        MockCurvePoolBoosterForBribes booster1 = MockCurvePoolBoosterForBribes(poolBooster1);
        MockCurvePoolBoosterForBribes booster2 = MockCurvePoolBoosterForBribes(poolBooster2);

        assertEq(booster1.callCount(), 1);
        assertEq(booster1.lastTotalRewardAmount(), type(uint256).max);
        assertEq(booster1.lastNumberOfPeriods(), 1);
        assertEq(booster1.lastMaxRewardPerVote(), 0);
        assertEq(booster1.lastAdditionalGasLimit(), curvePoolBoosterBribesModule.additionalGasLimit());
        assertEq(booster1.lastValue(), curvePoolBoosterBribesModule.bridgeFee());
        assertEq(booster1.lastCaller(), address(mockSafe));

        assertEq(booster2.callCount(), 1);
        assertEq(booster2.lastTotalRewardAmount(), type(uint256).max);
        assertEq(booster2.lastNumberOfPeriods(), 1);
        assertEq(booster2.lastMaxRewardPerVote(), 0);
        assertEq(booster2.lastAdditionalGasLimit(), curvePoolBoosterBribesModule.additionalGasLimit());
        assertEq(booster2.lastValue(), curvePoolBoosterBribesModule.bridgeFee());
        assertEq(booster2.lastCaller(), address(mockSafe));
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

    function test_manageBribes_usesETHForSelectedCountOnly() public {
        address[] memory selectedPoolBoosters = new address[](1);
        selectedPoolBoosters[0] = poolBooster1;
        vm.deal(address(mockSafe), curvePoolBoosterBribesModule.bridgeFee());

        vm.prank(operator);
        curvePoolBoosterBribesModule.manageBribes(selectedPoolBoosters);

        assertEq(MockCurvePoolBoosterForBribes(poolBooster1).callCount(), 1);
        assertEq(MockCurvePoolBoosterForBribes(poolBooster2).callCount(), 0);
        assertEq(address(mockSafe).balance, 0);
    }

    function test_manageBribes_RevertWhen_invalidPoolBooster() public {
        address[] memory selectedPoolBoosters = new address[](1);
        selectedPoolBoosters[0] = makeAddr("UnregisteredPoolBooster");

        vm.prank(operator);
        vm.expectRevert("Invalid pool booster");
        curvePoolBoosterBribesModule.manageBribes(selectedPoolBoosters);
    }

    function test_manageBribes_RevertWhen_duplicatePoolBooster() public {
        address[] memory selectedPoolBoosters = new address[](2);
        selectedPoolBoosters[0] = poolBooster1;
        selectedPoolBoosters[1] = poolBooster1;

        vm.prank(operator);
        vm.expectRevert("Duplicate pool booster");
        curvePoolBoosterBribesModule.manageBribes(selectedPoolBoosters);
    }

    function test_manageBribes_RevertWhen_emptyPoolList() public {
        address[] memory selectedPoolBoosters = new address[](0);

        vm.prank(operator);
        vm.expectRevert("Empty pool list");
        curvePoolBoosterBribesModule.manageBribes(selectedPoolBoosters);
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
