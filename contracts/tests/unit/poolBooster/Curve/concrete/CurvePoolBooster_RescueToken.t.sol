// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.sol";
import {CurvePoolBooster} from "contracts/poolBooster/curve/CurvePoolBooster.sol";
import {CurvePoolBoosterPlain} from "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol";
import {ICampaignRemoteManager} from "contracts/interfaces/ICampaignRemoteManager.sol";

contract Unit_Concrete_CurvePoolBooster_RescueToken_Test is Unit_Curve_Shared_Test {
    function test_rescueToken() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        vm.prank(governor);
        curvePoolBoosterPlain.rescueToken(address(oeth), alice);

        assertEq(oeth.balanceOf(address(curvePoolBoosterPlain)), 0);
        assertEq(oeth.balanceOf(alice), 1e18);
    }

    function test_rescueToken_event() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.TokensRescued(address(oeth), 1e18, alice);

        vm.prank(governor);
        curvePoolBoosterPlain.rescueToken(address(oeth), alice);
    }

    function test_rescueToken_RevertWhen_zeroReceiver() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        vm.prank(governor);
        vm.expectRevert("Invalid receiver");
        curvePoolBoosterPlain.rescueToken(address(oeth), address(0));
    }

    function test_rescueToken_RevertWhen_notGovernor() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        curvePoolBoosterPlain.rescueToken(address(oeth), alice);
    }

    function test_rescueToken_RevertWhen_strategistFails() public {
        _dealOETH(address(curvePoolBoosterPlain), 1e18);

        vm.prank(strategist);
        vm.expectRevert("Caller is not the Governor");
        curvePoolBoosterPlain.rescueToken(address(oeth), alice);
    }

    function test_rescueToken_zeroBalance() public {
        vm.expectEmit(true, true, true, true);
        emit CurvePoolBooster.TokensRescued(address(oeth), 0, alice);

        vm.prank(governor);
        curvePoolBoosterPlain.rescueToken(address(oeth), alice);

        assertEq(oeth.balanceOf(alice), 0);
    }
}
