// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.t.sol";

// --- Project imports
import {IMerklDistributor} from "contracts/interfaces/poolBooster/IMerklDistributor.sol";
import {IPoolBoosterMerkl} from "contracts/interfaces/poolBooster/IPoolBoosterMerkl.sol";

contract Unit_Concrete_PoolBoosterMerkl_Config_Test is Unit_Merkl_Shared_Test {
    function test_setDuration() public {
        vm.expectEmit(true, true, true, true);
        emit IPoolBoosterMerkl.DurationUpdated(3 hours);

        vm.prank(strategist);
        boosterMerkl.setDuration(3 hours);

        assertEq(boosterMerkl.duration(), 3 hours);
    }

    function test_setDuration_RevertWhen_tooShort() public {
        vm.prank(strategist);
        vm.expectRevert("Invalid duration");
        boosterMerkl.setDuration(1 hours);
    }

    function test_setDuration_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        boosterMerkl.setDuration(3 hours);
    }

    function test_setCampaignType() public {
        vm.expectEmit(true, true, true, true);
        emit IPoolBoosterMerkl.CampaignTypeUpdated(7);

        vm.prank(governor);
        boosterMerkl.setCampaignType(7);

        assertEq(boosterMerkl.campaignType(), 7);
    }

    function test_setCampaignType_RevertWhen_zero() public {
        vm.prank(strategist);
        vm.expectRevert("Invalid campaignType");
        boosterMerkl.setCampaignType(0);
    }

    function test_setCampaignType_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        boosterMerkl.setCampaignType(7);
    }

    function test_setRewardToken() public {
        address newRewardToken = makeAddr("NewRewardToken");

        vm.expectEmit(true, true, true, true);
        emit IPoolBoosterMerkl.RewardTokenUpdated(newRewardToken);

        vm.prank(strategist);
        boosterMerkl.setRewardToken(newRewardToken);

        assertEq(boosterMerkl.rewardToken(), newRewardToken);
    }

    function test_setRewardToken_RevertWhen_zero() public {
        vm.prank(strategist);
        vm.expectRevert("Invalid rewardToken address");
        boosterMerkl.setRewardToken(address(0));
    }

    function test_setRewardToken_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        boosterMerkl.setRewardToken(makeAddr("NewRewardToken"));
    }

    function test_setMerklDistributor() public {
        address newDistributor = makeAddr("NewMerklDistributor");
        vm.mockCall(newDistributor, abi.encodeWithSelector(IMerklDistributor.acceptConditions.selector), abi.encode());

        vm.expectEmit(true, true, true, true);
        emit IPoolBoosterMerkl.MerklDistributorUpdated(newDistributor);

        vm.prank(governor);
        boosterMerkl.setMerklDistributor(newDistributor);

        assertEq(boosterMerkl.merklDistributor(), newDistributor);
    }

    function test_setMerklDistributor_RevertWhen_zero() public {
        vm.prank(strategist);
        vm.expectRevert("Invalid merklDistributor addr");
        boosterMerkl.setMerklDistributor(address(0));
    }

    function test_setMerklDistributor_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        boosterMerkl.setMerklDistributor(makeAddr("NewMerklDistributor"));
    }

    function test_setCampaignData() public {
        bytes memory newCampaignData = hex"123456";

        vm.expectEmit(true, true, true, true);
        emit IPoolBoosterMerkl.CampaignDataUpdated(newCampaignData);

        vm.prank(strategist);
        boosterMerkl.setCampaignData(newCampaignData);

        assertEq(boosterMerkl.campaignData(), newCampaignData);
    }

    function test_setCampaignData_RevertWhen_empty() public {
        vm.prank(strategist);
        vm.expectRevert("Invalid campaign data");
        boosterMerkl.setCampaignData(hex"");
    }

    function test_setCampaignData_RevertWhen_unauthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        boosterMerkl.setCampaignData(hex"123456");
    }

    function test_rescueToken() public {
        _dealOETH(address(boosterMerkl), 1 ether);

        vm.expectEmit(true, true, true, true);
        emit IPoolBoosterMerkl.TokensRescued(address(oeth), 1 ether, alice);

        vm.prank(governor);
        boosterMerkl.rescueToken(address(oeth), alice);

        assertEq(oeth.balanceOf(address(boosterMerkl)), 0);
        assertEq(oeth.balanceOf(alice), 1 ether);
    }

    function test_rescueToken_RevertWhen_zeroReceiver() public {
        vm.prank(governor);
        vm.expectRevert("Invalid receiver");
        boosterMerkl.rescueToken(address(oeth), address(0));
    }

    function test_rescueToken_RevertWhen_notGovernor() public {
        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        boosterMerkl.rescueToken(address(oeth), alice);
    }
}
