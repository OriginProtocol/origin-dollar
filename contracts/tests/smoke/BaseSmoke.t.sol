// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Project imports
import {DeployManager} from "scripts/deploy/DeployManager.s.sol";
import {Resolver} from "scripts/deploy/helpers/Resolver.sol";

abstract contract BaseSmoke is BaseFork {
    Resolver internal resolver = Resolver(address(uint160(uint256(keccak256("Resolver")))));
    DeployManager internal deployManager;

    function _igniteDeployManager() internal {
        deployManager = new DeployManager();
        deployManager.setUp();
        deployManager.run();
    }
}
