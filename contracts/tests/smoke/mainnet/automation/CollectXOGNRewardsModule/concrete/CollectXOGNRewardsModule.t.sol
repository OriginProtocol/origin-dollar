// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Smoke_CollectXOGNRewardsModule_Shared_Test
} from "tests/smoke/mainnet/automation/CollectXOGNRewardsModule/shared/Shared.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Smoke_Concrete_CollectXOGNRewardsModule_Test is Smoke_CollectXOGNRewardsModule_Shared_Test {
    function test_xogn() public view {
        assertEq(address(collectXOGNRewardsModule.xogn()), Mainnet.xOGN);
    }

    function test_rewardsSource() public view {
        assertNotEq(collectXOGNRewardsModule.rewardsSource(), address(0));
    }

    function test_ogn() public view {
        assertEq(address(collectXOGNRewardsModule.ogn()), Mainnet.OGN);
    }

    function test_safeContract() public view {
        assertNotEq(address(collectXOGNRewardsModule.safeContract()), address(0));
    }

    function test_collectRewards() public {
        bytes32 operatorRole = collectXOGNRewardsModule.OPERATOR_ROLE();
        address operator = collectXOGNRewardsModule.getRoleMember(operatorRole, 0);
        address rewardsSource = collectXOGNRewardsModule.rewardsSource();
        IERC20 ogn = IERC20(address(collectXOGNRewardsModule.ogn()));
        address safe = address(collectXOGNRewardsModule.safeContract());

        uint256 safeOGNBefore = ogn.balanceOf(safe);
        uint256 rewardsSourceOGNBefore = ogn.balanceOf(rewardsSource);

        vm.prank(operator);
        collectXOGNRewardsModule.collectRewards();

        assertEq(ogn.balanceOf(safe), safeOGNBefore, "Safe OGN should be unchanged");
        assertGe(ogn.balanceOf(rewardsSource), rewardsSourceOGNBefore, "RewardsSource OGN should not decrease");
    }
}
