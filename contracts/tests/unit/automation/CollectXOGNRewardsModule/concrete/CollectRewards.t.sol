// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CollectXOGNRewardsModule_Shared_Test
} from "tests/unit/automation/CollectXOGNRewardsModule/shared/Shared.t.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_CollectXOGNRewardsModule_CollectRewards_Test is Unit_CollectXOGNRewardsModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- COLLECT REWARDS
    //////////////////////////////////////////////////////

    function test_collectRewards_collectsAndTransfersOGNToRewardsSource() public {
        uint256 rewardAmount = 100e18;
        xognMock.setRewardAmount(rewardAmount);

        vm.prank(operator);
        collectXOGNRewardsModule.collectRewards();

        assertEq(ognToken.balanceOf(REWARDS_SOURCE), rewardAmount);
        assertEq(ognToken.balanceOf(address(mockSafe)), 0);
    }

    function test_collectRewards_noopWhenZeroRewards() public {
        // rewardAmount defaults to 0, so collectRewards mints nothing
        xognMock.setRewardAmount(0);

        vm.prank(operator);
        collectXOGNRewardsModule.collectRewards();

        assertEq(ognToken.balanceOf(REWARDS_SOURCE), 0);
        assertEq(ognToken.balanceOf(address(mockSafe)), 0);
    }

    function test_collectRewards_handlesPreExistingOGNBalance() public {
        // Give the safe some pre-existing OGN balance
        uint256 preExisting = 50e18;
        ognToken.mint(address(mockSafe), preExisting);

        uint256 rewardAmount = 100e18;
        xognMock.setRewardAmount(rewardAmount);

        vm.prank(operator);
        collectXOGNRewardsModule.collectRewards();

        // Only the reward amount should be transferred, pre-existing balance stays
        assertEq(ognToken.balanceOf(REWARDS_SOURCE), rewardAmount);
        assertEq(ognToken.balanceOf(address(mockSafe)), preExisting);
    }

    function test_collectRewards_RevertWhen_safeExecFails() public {
        xognMock.setRewardAmount(100e18);
        mockSafe.setShouldFail(true);

        vm.prank(operator);
        vm.expectRevert("Failed to collect rewards");
        collectXOGNRewardsModule.collectRewards();
    }

    function test_collectRewards_RevertWhen_transferExecFails() public {
        xognMock.setRewardAmount(100e18);

        // Mock the OGN transfer call to revert (the second safe exec)
        vm.mockCallRevert(
            OGN_ADDRESS, abi.encodeWithSelector(IERC20.transfer.selector, REWARDS_SOURCE, 100e18), "transfer failed"
        );

        vm.prank(operator);
        vm.expectRevert("Failed to collect rewards");
        collectXOGNRewardsModule.collectRewards();
    }

    function test_collectRewards_RevertWhen_notOperator() public {
        vm.prank(josh);
        vm.expectRevert();
        collectXOGNRewardsModule.collectRewards();
    }
}
