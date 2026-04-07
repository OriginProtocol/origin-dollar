// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";
import {ICurvePoolBooster} from "contracts/interfaces/poolBooster/ICurvePoolBooster.sol";

contract Unit_Concrete_CurvePoolBooster_RescueETH_Test is Unit_Curve_Shared_Test {
    function test_rescueETH() public {
        vm.deal(address(curvePoolBoosterPlain), 1 ether);
        uint256 aliceBalanceBefore = alice.balance;

        vm.prank(governor);
        curvePoolBoosterPlain.rescueETH(alice);

        assertEq(address(curvePoolBoosterPlain).balance, 0);
        assertEq(alice.balance, aliceBalanceBefore + 1 ether);
    }

    function test_rescueETH_event() public {
        vm.deal(address(curvePoolBoosterPlain), 1 ether);

        vm.expectEmit(true, true, true, true);
        emit ICurvePoolBooster.TokensRescued(address(0), 1 ether, alice);

        vm.prank(governor);
        curvePoolBoosterPlain.rescueETH(alice);
    }

    function test_rescueETH_RevertWhen_zeroReceiver() public {
        vm.deal(address(curvePoolBoosterPlain), 1 ether);

        vm.prank(governor);
        vm.expectRevert("Invalid receiver");
        curvePoolBoosterPlain.rescueETH(address(0));
    }

    function test_rescueETH_RevertWhen_notAuthorized() public {
        vm.deal(address(curvePoolBoosterPlain), 1 ether);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        curvePoolBoosterPlain.rescueETH(alice);
    }

    function test_rescueETH_zeroBalance() public {
        uint256 aliceBalanceBefore = alice.balance;

        vm.expectEmit(true, true, true, true);
        emit ICurvePoolBooster.TokensRescued(address(0), 0, alice);

        vm.prank(governor);
        curvePoolBoosterPlain.rescueETH(alice);

        assertEq(alice.balance, aliceBalanceBefore);
    }

    function test_rescueETH_strategistCanCall() public {
        vm.deal(address(curvePoolBoosterPlain), 1 ether);

        vm.prank(strategist);
        curvePoolBoosterPlain.rescueETH(alice);

        assertEq(address(curvePoolBoosterPlain).balance, 0);
        assertEq(alice.balance, 1 ether);
    }

    function test_rescueETH_RevertWhen_transferFailed() public {
        vm.deal(address(curvePoolBoosterPlain), 1 ether);

        // Deploy a contract that rejects ETH transfers
        ETHRejecter rejecter = new ETHRejecter();

        vm.prank(governor);
        vm.expectRevert("Transfer failed");
        curvePoolBoosterPlain.rescueETH(address(rejecter));
    }
}

/// @notice Helper contract that rejects ETH transfers
contract ETHRejecter {
    // No receive() or fallback() - will revert on ETH transfer

    }
