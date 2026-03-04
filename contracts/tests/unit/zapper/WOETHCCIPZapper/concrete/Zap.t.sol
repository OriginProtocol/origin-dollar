// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_WOETHCCIPZapper_Shared_Test} from "tests/unit/zapper/WOETHCCIPZapper/shared/Shared.sol";
import {WOETHCCIPZapper} from "contracts/zapper/WOETHCCIPZapper.sol";

contract Unit_Concrete_WOETHCCIPZapper_Zap_Test is Unit_WOETHCCIPZapper_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- zap()
    //////////////////////////////////////////////////////

    function test_zap_basic() public {
        _dealETH(alice, 1 ether);

        vm.prank(alice);
        bytes32 messageId = woethCcipZapper.zap{value: 1 ether}(alice);

        assertEq(messageId, MOCK_MESSAGE_ID);
    }

    function test_zap_emitsZap() public {
        _dealETH(alice, 1 ether);
        uint256 expectedAmount = 1 ether - CCIP_FEE;

        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(woethCcipZapper));
        emit Zap(MOCK_MESSAGE_ID, alice, alice, expectedAmount);
        woethCcipZapper.zap{value: 1 ether}(alice);
    }

    function test_zap_withDifferentReceiver() public {
        _dealETH(alice, 1 ether);
        uint256 expectedAmount = 1 ether - CCIP_FEE;

        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(woethCcipZapper));
        emit Zap(MOCK_MESSAGE_ID, alice, bobby, expectedAmount);
        bytes32 messageId = woethCcipZapper.zap{value: 1 ether}(bobby);

        assertEq(messageId, MOCK_MESSAGE_ID);
    }

    function test_zap_RevertWhen_amountLessThanFee() public {
        _dealETH(alice, 0.005 ether);

        vm.prank(alice);
        vm.expectRevert(WOETHCCIPZapper.AmountLessThanFee.selector);
        woethCcipZapper.zap{value: 0.005 ether}(alice);
    }

    function test_zap_viaReceive() public {
        _dealETH(alice, 1 ether);

        vm.prank(alice);
        (bool success,) = address(woethCcipZapper).call{value: 1 ether}("");
        assertTrue(success);
    }

    //////////////////////////////////////////////////////
    /// --- EVENTS
    //////////////////////////////////////////////////////
    event Zap(
        bytes32 indexed messageId,
        address sender,
        address recipient,
        uint256 amount
    );
}
