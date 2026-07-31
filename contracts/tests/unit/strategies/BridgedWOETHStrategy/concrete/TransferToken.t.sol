// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BridgedWOETHStrategy_Shared_Test} from "tests/unit/strategies/BridgedWOETHStrategy/shared/Shared.t.sol";

// --- External libraries
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

contract Unit_Concrete_BridgedWOETHStrategy_TransferToken_Test is Unit_BridgedWOETHStrategy_Shared_Test {
    function test_transferToken_transfersUnsupportedAsset() public {
        MockERC20 randomToken = new MockERC20("Random", "RND", 18);
        randomToken.mint(address(bridgedWOETHStrategy), 100e18);

        vm.prank(governor);
        bridgedWOETHStrategy.transferToken(address(randomToken), 100e18);

        assertEq(randomToken.balanceOf(governor), 100e18);
        assertEq(randomToken.balanceOf(address(bridgedWOETHStrategy)), 0);
    }

    function test_transferToken_RevertWhen_transferBridgedWOETH() public {
        vm.prank(governor);
        vm.expectRevert("Cannot transfer supported asset");
        bridgedWOETHStrategy.transferToken(address(bridgedWOETH), 1e18);
    }

    function test_transferToken_RevertWhen_transferWeth() public {
        vm.prank(governor);
        vm.expectRevert("Cannot transfer supported asset");
        bridgedWOETHStrategy.transferToken(address(mockWeth), 1e18);
    }

    function test_transferToken_RevertWhen_calledByNonGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        bridgedWOETHStrategy.transferToken(address(0xdead), 1e18);
    }
}
