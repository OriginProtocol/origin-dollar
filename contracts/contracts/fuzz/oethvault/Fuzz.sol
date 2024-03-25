// SPDX-License-Identifier: MIT
import {FuzzSetup} from "./FuzzSetup.sol";
import {FuzzOETH} from "./FuzzOETH.sol";
import {FuzzVault} from "./FuzzVault.sol";
import {FuzzGlobal} from "./FuzzGlobal.sol";
import {FuzzSelfTest} from "./FuzzSelfTest.sol";

/**
 * @title Top-level Fuzz contract to be deployed by Echidna.
 * @author Rappie <rappie@perimetersec.io>
 */
contract Fuzz is
    FuzzOETH, // Fuzz tests for OETH
    FuzzVault, // Fuzz tests for Vault
    FuzzGlobal, // Global invariants
    FuzzSelfTest // Self-tests (for debugging)
{
    constructor() payable FuzzSetup() {}
}
