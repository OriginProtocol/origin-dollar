// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Tokens} from "tests/utils/artifacts/Tokens.sol";

// Interfaces
import {IOToken} from "contracts/interfaces/IOToken.sol";

abstract contract Symbolic_OUSD_Shared_Test is Base {
    bytes32 internal constant GOVERNOR_SLOT = keccak256("OUSD.governor");

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
        // Set the unstructured governor slot so the implementation can be initialized.
        vm.store(address(ousd), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));
        vm.prank(governor);
        ousd.initialize(operator, 1e27);

        vm.startPrank(operator);
        ousd.mint(operator, 1 ether);
        vm.stopPrank();

        vm.setArbitraryStorage(address(ousd));
    }
}
