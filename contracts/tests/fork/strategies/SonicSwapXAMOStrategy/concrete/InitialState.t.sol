// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_SonicSwapXAMOStrategy_Shared_Test} from
    "tests/fork/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";
import {Sonic} from "tests/utils/Addresses.sol";
import {SonicSwapXAMOStrategy} from "contracts/strategies/sonic/SonicSwapXAMOStrategy.sol";

contract Fork_Concrete_SonicSwapXAMOStrategy_InitialState_Test is Fork_SonicSwapXAMOStrategy_Shared_Test {
    function test_constantsAndImmutables() public view {
        assertEq(sonicSwapXAMOStrategy.SOLVENCY_THRESHOLD(), 0.998 ether);
        assertEq(sonicSwapXAMOStrategy.ws(), Sonic.wS);
        assertEq(sonicSwapXAMOStrategy.os(), address(oSonic));
        assertEq(sonicSwapXAMOStrategy.pool(), address(swapXPool));
        assertEq(sonicSwapXAMOStrategy.gauge(), address(swapXGauge));
        assertEq(sonicSwapXAMOStrategy.governor(), governor);
        assertTrue(sonicSwapXAMOStrategy.supportsAsset(Sonic.wS));
        assertEq(sonicSwapXAMOStrategy.maxDepeg(), DEFAULT_MAX_DEPEG);
    }

    function test_checkBalance() public view {
        uint256 balance = sonicSwapXAMOStrategy.checkBalance(Sonic.wS);
        assertEq(balance, 0);
    }

    function test_safeApproveAllTokens_onlyGovernor() public {
        // Timelock (governor) can approve all tokens
        vm.prank(governor);
        sonicSwapXAMOStrategy.safeApproveAllTokens();

        // Others cannot
        address[3] memory unauthorized = [strategist, nick, address(oSonicVault)];
        for (uint256 i = 0; i < unauthorized.length; i++) {
            vm.prank(unauthorized[i]);
            vm.expectRevert("Caller is not the Governor");
            sonicSwapXAMOStrategy.safeApproveAllTokens();
        }
    }

    function test_setMaxDepeg_onlyGovernor() public {
        uint256 newMaxDepeg = 0.02 ether;

        // Timelock can update
        vm.prank(governor);
        vm.expectEmit(address(sonicSwapXAMOStrategy));
        emit SonicSwapXAMOStrategy.MaxDepegUpdated(newMaxDepeg);
        sonicSwapXAMOStrategy.setMaxDepeg(newMaxDepeg);

        assertEq(sonicSwapXAMOStrategy.maxDepeg(), newMaxDepeg);

        // Others cannot
        address[3] memory unauthorized = [strategist, nick, address(oSonicVault)];
        for (uint256 i = 0; i < unauthorized.length; i++) {
            vm.prank(unauthorized[i]);
            vm.expectRevert("Caller is not the Governor");
            sonicSwapXAMOStrategy.setMaxDepeg(newMaxDepeg);
        }
    }
}
