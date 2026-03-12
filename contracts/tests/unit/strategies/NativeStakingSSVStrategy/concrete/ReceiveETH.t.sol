// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_NativeStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_NativeStakingSSVStrategy_ReceiveETH_Test is Unit_NativeStakingSSVStrategy_Shared_Test {
    function test_receiveETH_RevertWhen_senderNotAllowed() public {
        vm.prank(strategist);
        vm.expectRevert("Eth not from allowed contracts");
        (bool success,) = address(nativeStakingSSVStrategy).call{value: 2 ether}("");
        // expectRevert catches the revert, but call itself returns success=true from vm perspective
        success; // silence unused warning
    }

    function test_receiveETH_acceptsFromFeeAccumulator() public {
        vm.deal(address(nativeStakingFeeAccumulator), 2 ether);
        vm.prank(address(nativeStakingFeeAccumulator));
        (bool success,) = address(nativeStakingSSVStrategy).call{value: 2 ether}("");
        assertTrue(success);
    }

    function test_receiveETH_acceptsFromWETH() public {
        vm.deal(address(mockWeth), 2 ether);
        vm.prank(address(mockWeth));
        (bool success,) = address(nativeStakingSSVStrategy).call{value: 2 ether}("");
        assertTrue(success);
    }
}
