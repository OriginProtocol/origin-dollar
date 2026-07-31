// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Fork_AerodromeAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Fork_AerodromeAMOStrategy_CollectRewards_Test is Fork_AerodromeAMOStrategy_Shared_Test {
    function test_collectRewardTokens() public {
        // Deal AERO tokens to strategy (simulating accumulated rewards)
        deal(BaseAddresses.AERO, address(aerodromeAMOStrategy), 1337 ether);

        uint256 harvesterAeroBefore = IERC20(BaseAddresses.AERO).balanceOf(harvester);

        vm.prank(harvester);
        aerodromeAMOStrategy.collectRewardTokens();

        uint256 harvesterAeroAfter = IERC20(BaseAddresses.AERO).balanceOf(harvester);
        assertGe(harvesterAeroAfter - harvesterAeroBefore, 1337 ether, "Harvester should receive AERO");

        _verifyEndConditions(true);
    }

    function test_collectRewardTokens_noOpWhenNoRewards() public {
        uint256 harvesterAeroBefore = IERC20(BaseAddresses.AERO).balanceOf(harvester);

        vm.prank(harvester);
        aerodromeAMOStrategy.collectRewardTokens();

        uint256 harvesterAeroAfter = IERC20(BaseAddresses.AERO).balanceOf(harvester);
        // Should not revert, rewards may be 0 or very small from gauge
        assertGe(harvesterAeroAfter, harvesterAeroBefore, "Should not lose AERO");
    }
}
