// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_CurveAMOStrategy_Shared_Test} from "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";

// --- Project imports
import {ICurveAMOStrategy} from "contracts/interfaces/strategies/ICurveAMOStrategy.sol";

contract Unit_Concrete_CurveAMOStrategy_Configuration_Test is Unit_CurveAMOStrategy_Shared_Test {
    function test_setHarvesterAddress_governorUpdatesHarvester() public {
        address newHarvester = makeAddr("New Harvester");

        vm.prank(governor);
        curveAMOStrategy.setHarvesterAddress(newHarvester);

        assertEq(curveAMOStrategy.harvesterAddress(), newHarvester);
    }

    function test_setHarvesterAddress_strategistUpdatesHarvester() public {
        address newHarvester = makeAddr("New Harvester");

        vm.prank(strategist);
        curveAMOStrategy.setHarvesterAddress(newHarvester);

        assertEq(curveAMOStrategy.harvesterAddress(), newHarvester);
    }

    function test_setHarvesterAddress_emitsEvent() public {
        address newHarvester = makeAddr("New Harvester");

        vm.expectEmit(false, false, false, true);
        emit ICurveAMOStrategy.HarvesterAddressesUpdated(harvester, newHarvester);

        vm.prank(governor);
        curveAMOStrategy.setHarvesterAddress(newHarvester);
    }

    function test_setHarvesterAddress_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        curveAMOStrategy.setHarvesterAddress(makeAddr("New Harvester"));
    }

    function test_setRewardTokenAddresses_governorReplacesRewardTokens() public {
        address[] memory newRewardTokens = _newRewardTokens();

        vm.prank(governor);
        curveAMOStrategy.setRewardTokenAddresses(newRewardTokens);

        assertEq(curveAMOStrategy.getRewardTokenAddresses(), newRewardTokens);
        assertEq(curveAMOStrategy.rewardTokenAddresses(0), newRewardTokens[0]);
        assertEq(curveAMOStrategy.rewardTokenAddresses(1), newRewardTokens[1]);
    }

    function test_setRewardTokenAddresses_emitsEvent() public {
        address[] memory oldRewardTokens = curveAMOStrategy.getRewardTokenAddresses();
        address[] memory newRewardTokens = _newRewardTokens();

        vm.expectEmit(false, false, false, true);
        emit ICurveAMOStrategy.RewardTokenAddressesUpdated(oldRewardTokens, newRewardTokens);

        vm.prank(governor);
        curveAMOStrategy.setRewardTokenAddresses(newRewardTokens);
    }

    function test_setRewardTokenAddresses_RevertWhen_calledByStrategist() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        curveAMOStrategy.setRewardTokenAddresses(_newRewardTokens());
    }

    function test_setRewardTokenAddresses_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        curveAMOStrategy.setRewardTokenAddresses(_newRewardTokens());
    }

    function test_setRewardTokenAddresses_RevertWhen_zeroAddress() public {
        address[] memory newRewardTokens = _newRewardTokens();
        newRewardTokens[1] = address(0);

        vm.prank(governor);
        vm.expectRevert("Can not set an empty address as a reward token");
        curveAMOStrategy.setRewardTokenAddresses(newRewardTokens);
    }

    function _newRewardTokens() internal returns (address[] memory rewardTokens) {
        rewardTokens = new address[](2);
        rewardTokens[0] = makeAddr("Reward Token 1");
        rewardTokens[1] = makeAddr("Reward Token 2");
    }
}
