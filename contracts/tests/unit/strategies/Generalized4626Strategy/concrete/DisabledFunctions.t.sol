// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_Generalized4626Strategy_Shared_Test
} from "tests/unit/strategies/Generalized4626Strategy/shared/Shared.t.sol";

contract Unit_Concrete_Generalized4626Strategy_DisabledFunctions_Test is Unit_Generalized4626Strategy_Shared_Test {
    function test_setPTokenAddress_RevertWhen_called() public {
        vm.prank(governor);
        vm.expectRevert("unsupported function");
        strategy.setPTokenAddress(address(0xdead), address(0xbeef));
    }

    function test_removePToken_RevertWhen_called() public {
        vm.prank(governor);
        vm.expectRevert("unsupported function");
        strategy.removePToken(0);
    }
}
