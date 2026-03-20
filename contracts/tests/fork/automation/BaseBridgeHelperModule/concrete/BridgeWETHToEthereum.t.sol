// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_BaseBridgeHelperModule_Shared_Test
} from "tests/fork/automation/BaseBridgeHelperModule/shared/Shared.t.sol";

contract Fork_Concrete_BaseBridgeHelperModule_BridgeWETHToEthereum_Test is Fork_BaseBridgeHelperModule_Shared_Test {
    function test_bridgeWETHToEthereum() public {
        uint256 amount = 1 ether;
        _fundWithWETH(safeSigner, amount);

        vm.prank(safeSigner);
        baseBridgeHelperModule.bridgeWETHToEthereum(amount);
    }
}
