// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_WOETHCCIPZapper_Shared_Test} from "tests/unit/zapper/WOETHCCIPZapper/shared/Shared.t.sol";

contract Unit_Concrete_WOETHCCIPZapper_GetFee_Test is Unit_WOETHCCIPZapper_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- getFee()
    //////////////////////////////////////////////////////

    function test_getFee_returnsExpectedFee() public view {
        uint256 fee = woethCcipZapper.getFee(1 ether, alice);
        assertEq(fee, CCIP_FEE);
    }

    function test_getFee_returnsUpdatedFee() public {
        _mockCCIPFee(0.05 ether);
        uint256 fee = woethCcipZapper.getFee(1 ether, alice);
        assertEq(fee, 0.05 ether);
    }
}
