// SPDX-License-Identifier: MIT
import {FuzzSetup} from "./FuzzSetup.sol";

import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {OUSD} from "../../token/OUSD.sol";

/**
 * @title Contract containing fuzz tests for OETH
 * @author Rappie <rappie@perimetersec.io>
 */
contract FuzzOETH is FuzzSetup {
    /**
     * @notice Transfer OETH to another actor
     * @param toActorIndex Index of the actor to transfer to
     * @param amount Amount of OETH to transfer
     */
    function transfer(
        uint8 toActorIndex,
        uint256 amount
    ) public setCurrentActor {
        address to = ACTORS[clampBetween(toActorIndex, 0, ACTORS.length - 1)];
        amount = clampBetween(amount, 0, oeth.balanceOf(currentActor));

        vm.prank(currentActor);
        try oeth.transfer(to, amount) {} catch {
            t(false, "OETH-01: No unwanted reverts when transfering OETH");
        }
    }

    /**
     * @notice Opt in to rebase
     */
    function optIn() public setCurrentActor {
        if (oeth.rebaseState(currentActor) == OUSD.RebaseOptions.OptIn)
            revert FuzzRequireError();
        if (
            !Address.isContract(currentActor) &&
            oeth.rebaseState(currentActor) == OUSD.RebaseOptions.NotSet
        ) revert FuzzRequireError();

        vm.prank(currentActor);
        try oeth.rebaseOptIn() {} catch {
            t(false, "OETH-02: No unwanted reverts when opting in to rebase");
        }
    }

    /**
     * @notice Opt out of rebase
     */
    function optOut() public setCurrentActor {
        if (oeth.rebaseState(currentActor) == OUSD.RebaseOptions.OptOut)
            revert FuzzRequireError();
        if (
            Address.isContract(currentActor) &&
            oeth.rebaseState(currentActor) == OUSD.RebaseOptions.NotSet
        ) revert FuzzRequireError();

        vm.prank(currentActor);
        try oeth.rebaseOptOut() {} catch {
            t(false, "OETH-03: No unwanted reverts when opting out of rebase");
        }
    }
}
