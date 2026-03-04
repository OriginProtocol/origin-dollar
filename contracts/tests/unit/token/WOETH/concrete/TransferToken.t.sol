// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_WOETH_Shared_Test} from "tests/unit/token/WOETH/shared/Shared.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

contract Unit_Concrete_WOETH_TransferToken_Test is Unit_WOETH_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- TRANSFER TOKEN (Governor token recovery)
    //////////////////////////////////////////////////////

    function test_transferToken_recoversStuckToken() public {
        // Create a random ERC20 and send to WOETH
        MockERC20 stuckToken = new MockERC20("Stuck", "STK", 18);
        stuckToken.mint(address(woeth), 100e18);

        uint256 govBefore = stuckToken.balanceOf(governor);

        vm.prank(governor);
        woeth.transferToken(address(stuckToken), 100e18);

        assertEq(stuckToken.balanceOf(governor), govBefore + 100e18);
        assertEq(stuckToken.balanceOf(address(woeth)), 0);
    }

    function test_transferToken_RevertWhen_coreAsset() public {
        vm.prank(governor);
        vm.expectRevert("Cannot collect core asset");
        woeth.transferToken(address(oeth), 1e18);
    }

    function test_transferToken_RevertWhen_notGovernor() public {
        MockERC20 stuckToken = new MockERC20("Stuck", "STK", 18);
        stuckToken.mint(address(woeth), 100e18);

        vm.prank(matt);
        vm.expectRevert("Caller is not the Governor");
        woeth.transferToken(address(stuckToken), 100e18);
    }

    function test_transferToken_partialAmount() public {
        MockERC20 stuckToken = new MockERC20("Stuck", "STK", 18);
        stuckToken.mint(address(woeth), 100e18);

        vm.prank(governor);
        woeth.transferToken(address(stuckToken), 40e18);

        assertEq(stuckToken.balanceOf(governor), 40e18);
        assertEq(stuckToken.balanceOf(address(woeth)), 60e18);
    }
}
