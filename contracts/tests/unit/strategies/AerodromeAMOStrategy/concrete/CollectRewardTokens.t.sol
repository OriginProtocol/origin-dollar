// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_AerodromeAMOStrategy_Shared_Test} from "tests/unit/strategies/AerodromeAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_AerodromeAMOStrategy_CollectRewardTokens_Test is Unit_AerodromeAMOStrategy_Shared_Test {
    function test_collectRewardTokens() public {
        // Deposit to create position and stake in gauge
        _depositAsVault(10 ether);

        // Deal some AERO reward tokens to strategy (simulate gauge rewards)
        deal(address(aeroToken), address(aerodromeAMOStrategy), 5 ether);

        uint256 harvesterBalBefore = aeroToken.balanceOf(harvester);

        vm.prank(harvester);
        aerodromeAMOStrategy.collectRewardTokens();

        // AERO should have been transferred to harvester
        assertEq(aeroToken.balanceOf(harvester) - harvesterBalBefore, 5 ether);
    }

    function test_collectRewardTokens_noPosition() public {
        // No position, tokenId == 0 -> should not revert
        deal(address(aeroToken), address(aerodromeAMOStrategy), 5 ether);

        vm.prank(harvester);
        aerodromeAMOStrategy.collectRewardTokens();

        // AERO should still be transferred
        assertEq(aeroToken.balanceOf(harvester), 5 ether);
    }

    function test_collectRewardTokens_RevertWhen_notHarvester() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Harvester");
        aerodromeAMOStrategy.collectRewardTokens();
    }

    function test_collectRewardTokens_positionExistsNotStaked() public {
        // Create a position (NFT staked in gauge)
        _depositAsVault(10 ether);

        // withdrawAll removes liquidity – NFT stays owned by strategy (not re-staked)
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.withdrawAll();

        // Confirm tokenId is set but not staked in gauge
        assertGt(aerodromeAMOStrategy.tokenId(), 0);
        assertEq(mockPositionManager.ownerOf(aerodromeAMOStrategy.tokenId()), address(aerodromeAMOStrategy));

        deal(address(aeroToken), address(aerodromeAMOStrategy), 3 ether);

        // Should not revert even though position is not staked
        vm.prank(harvester);
        aerodromeAMOStrategy.collectRewardTokens();

        assertEq(aeroToken.balanceOf(harvester), 3 ether);
    }
}
