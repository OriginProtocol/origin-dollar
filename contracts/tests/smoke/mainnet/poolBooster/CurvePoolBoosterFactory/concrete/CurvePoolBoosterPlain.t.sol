// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {
    Smoke_CurvePoolBoosterFactory_Shared_Test
} from "tests/smoke/mainnet/poolBooster/CurvePoolBoosterFactory/shared/Shared.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";
import {CrossChain} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_CurvePoolBoosterPlain_Test is Smoke_CurvePoolBoosterFactory_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_governor() public view {
        assertNotEq(curvePoolBoosterPlain.governor(), address(0));
    }

    function test_strategist() public view {
        assertNotEq(curvePoolBoosterPlain.strategistAddr(), address(0));
    }

    function test_rewardToken() public view {
        assertEq(curvePoolBoosterPlain.rewardToken(), Mainnet.OETHProxy);
    }

    function test_gauge() public view {
        assertNotEq(curvePoolBoosterPlain.gauge(), address(0));
    }

    function test_fee() public view {
        assertLe(curvePoolBoosterPlain.fee(), curvePoolBoosterPlain.FEE_BASE() / 2);
    }

    function test_feeBase() public view {
        assertEq(curvePoolBoosterPlain.FEE_BASE(), 10_000);
    }

    function test_feeCollector() public view {
        assertNotEq(curvePoolBoosterPlain.feeCollector(), address(0));
    }

    function test_campaignRemoteManager() public view {
        assertEq(curvePoolBoosterPlain.campaignRemoteManager(), Mainnet.CampaignRemoteManager);
    }

    function test_votemarket() public view {
        assertEq(curvePoolBoosterPlain.votemarket(), CrossChain.votemarket);
    }

    function test_targetChainId() public view {
        assertEq(curvePoolBoosterPlain.targetChainId(), 42161);
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////

    function test_createCampaign() public {
        address boosterStrategist = curvePoolBoosterPlain.strategistAddr();

        // Ensure campaignId is 0 before creating
        if (curvePoolBoosterPlain.campaignId() != 0) {
            vm.prank(boosterStrategist);
            curvePoolBoosterPlain.setCampaignId(0);
        }

        // Transfer OETH from whale to booster
        vm.prank(Mainnet.oethWhaleAddress);
        IERC20(Mainnet.OETHProxy).transfer(address(curvePoolBoosterPlain), 10 ether);

        address[] memory blacklist = new address[](1);
        blacklist[0] = Mainnet.ConvexVoter;

        vm.deal(boosterStrategist, 1 ether);
        vm.prank(boosterStrategist);
        curvePoolBoosterPlain.createCampaign{value: 0.1 ether}(4, 10, blacklist, 0);

        // All OETH should have been sent to the CampaignRemoteManager
        assertEq(IERC20(Mainnet.OETHProxy).balanceOf(address(curvePoolBoosterPlain)), 0);
    }

    function test_manageCampaign() public {
        address boosterStrategist = curvePoolBoosterPlain.strategistAddr();

        // Set a non-zero campaignId so manageCampaign can be called
        vm.prank(boosterStrategist);
        curvePoolBoosterPlain.setCampaignId(1);

        // Transfer OETH from whale to booster
        vm.prank(Mainnet.oethWhaleAddress);
        IERC20(Mainnet.OETHProxy).transfer(address(curvePoolBoosterPlain), 5 ether);

        assertGt(IERC20(Mainnet.OETHProxy).balanceOf(address(curvePoolBoosterPlain)), 0);

        vm.deal(boosterStrategist, 1 ether);
        vm.prank(boosterStrategist);
        curvePoolBoosterPlain.manageCampaign{value: 0.1 ether}(type(uint256).max, 0, 0, 0);

        // Balance should be 0 (all sent to CampaignRemoteManager)
        assertEq(IERC20(Mainnet.OETHProxy).balanceOf(address(curvePoolBoosterPlain)), 0);
    }

    function test_closeCampaign() public {
        address boosterStrategist = curvePoolBoosterPlain.strategistAddr();

        // Set a fake campaignId
        vm.prank(boosterStrategist);
        curvePoolBoosterPlain.setCampaignId(42);
        assertEq(curvePoolBoosterPlain.campaignId(), 42);

        vm.deal(boosterStrategist, 1 ether);
        vm.prank(boosterStrategist);
        curvePoolBoosterPlain.closeCampaign{value: 0.1 ether}(42, 0);

        // campaignId should be reset to 0
        assertEq(curvePoolBoosterPlain.campaignId(), 0);
    }
}
