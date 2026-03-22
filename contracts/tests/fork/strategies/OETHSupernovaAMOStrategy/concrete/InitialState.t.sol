// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/fork/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";
import {StableSwapAMMStrategy} from "contracts/strategies/algebra/StableSwapAMMStrategy.sol";

contract Fork_Concrete_OETHSupernovaAMOStrategy_InitialState_Test is Fork_OETHSupernovaAMOStrategy_Shared_Test {
    function test_constantsAndImmutables() public view {
        assertEq(oethSupernovaAMOStrategy.SOLVENCY_THRESHOLD(), 0.998 ether);
        assertEq(oethSupernovaAMOStrategy.asset(), Mainnet.WETH);
        assertEq(oethSupernovaAMOStrategy.oToken(), address(oeth));
        assertEq(oethSupernovaAMOStrategy.pool(), address(supernovaPool));
        assertEq(oethSupernovaAMOStrategy.gauge(), address(supernovaGauge));
        assertEq(oethSupernovaAMOStrategy.governor(), governor);
        assertTrue(oethSupernovaAMOStrategy.supportsAsset(Mainnet.WETH));
        assertEq(oethSupernovaAMOStrategy.maxDepeg(), DEFAULT_MAX_DEPEG);
    }

    function test_checkBalance() public view {
        uint256 balance = oethSupernovaAMOStrategy.checkBalance(Mainnet.WETH);
        assertEq(balance, 0);
    }

    function test_safeApproveAllTokens_onlyGovernor() public {
        // Timelock (governor) can approve all tokens
        vm.prank(governor);
        oethSupernovaAMOStrategy.safeApproveAllTokens();

        // Others cannot
        address[3] memory unauthorized = [strategist, nick, address(oethVault)];
        for (uint256 i = 0; i < unauthorized.length; i++) {
            vm.prank(unauthorized[i]);
            vm.expectRevert("Caller is not the Governor");
            oethSupernovaAMOStrategy.safeApproveAllTokens();
        }
    }

    function test_setMaxDepeg_onlyGovernor() public {
        uint256 newMaxDepeg = 0.02 ether;

        // Timelock can update
        vm.prank(governor);
        vm.expectEmit(address(oethSupernovaAMOStrategy));
        emit StableSwapAMMStrategy.MaxDepegUpdated(newMaxDepeg);
        oethSupernovaAMOStrategy.setMaxDepeg(newMaxDepeg);

        assertEq(oethSupernovaAMOStrategy.maxDepeg(), newMaxDepeg);

        // Others cannot
        address[3] memory unauthorized = [strategist, nick, address(oethVault)];
        for (uint256 i = 0; i < unauthorized.length; i++) {
            vm.prank(unauthorized[i]);
            vm.expectRevert("Caller is not the Governor");
            oethSupernovaAMOStrategy.setMaxDepeg(newMaxDepeg);
        }
    }
}
