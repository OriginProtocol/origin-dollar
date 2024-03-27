// SPDX-License-Identifier: MIT
import {FuzzConfig} from "./FuzzConfig.sol";

/**
 * @title Contract containing the actor setup.
 * @author Rappie <rappie@perimetersec.io>
 */
contract FuzzActor is FuzzConfig {
    // Actors are the addresses to be used as senders.
    address internal constant ADDRESS_ACTOR1 = address(0x10000);
    address internal constant ADDRESS_ACTOR2 = address(0x20000);
    address internal constant ADDRESS_ACTOR3 = address(0x30000);
    address internal constant ADDRESS_ACTOR4 = address(0x40000);

    // Outsiders are addresses meant to contain funds but not take actions.
    address internal constant ADDRESS_OUTSIDER_REBASING = address(0x50000);
    address internal constant ADDRESS_OUTSIDER_NONREBASING = address(0x60000);

    // List of all actors
    address[] internal ACTORS = [
        ADDRESS_ACTOR1,
        ADDRESS_ACTOR2,
        ADDRESS_ACTOR3,
        ADDRESS_ACTOR4
    ];

    // Variable containing current actor.
    address internal currentActor;

    // Debug toggle to disable setting the current actor.
    bool internal constant DEBUG_TOGGLE_SET_ACTOR = true;

    /// @notice Modifier storing `msg.sender` for the duration of the function call.
    modifier setCurrentActor() {
        address previousActor = currentActor;
        if (DEBUG_TOGGLE_SET_ACTOR) {
            currentActor = msg.sender;
        }

        _;

        if (DEBUG_TOGGLE_SET_ACTOR) {
            currentActor = previousActor;
        }
    }
}
