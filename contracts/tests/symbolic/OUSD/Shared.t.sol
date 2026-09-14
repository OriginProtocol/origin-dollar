// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import { Base } from "tests/Base.t.sol";

// --- Test utilities
import { Tokens } from "tests/utils/artifacts/Tokens.sol";

// Interfaces
import { IOToken } from "contracts/interfaces/IOToken.sol";

abstract contract Symbolic_OUSD_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////
    IOToken internal ousd;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////
    function setUp() public virtual override {
        super.setUp();

        ousd = IOToken(vm.deployCode(Tokens.OUSD));

        // Certora targets OUSD.sol directly rather than executing through the proxy.
        // Start from arbitrary storage, constrained by each symbolic check.
        vm.setArbitraryStorage(address(ousd), true);
    }
}
