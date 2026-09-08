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

    /// @dev Applying the pending deploys means simulating their governance, and that moves the fork
    ///      clock forward — the Base timelock alone has a 2 day delay, and GovernorSix needs its
    ///      whole voting window. The jump is an artifact of the simulation, not of the deployment.
    ///      Smoke tests assert against live chain state and several of them read Chainlink feeds,
    ///      which go stale and revert once the clock runs past their heartbeat. Put the clock back
    ///      afterwards so every suite observes the chain at the timestamp it forked from.
    function _igniteDeployManager() internal {
        uint256 forkTimestamp = block.timestamp;

        deployManager = new DeployManager();
        deployManager.setUp();
        deployManager.run();

        if (block.timestamp != forkTimestamp) {
            vm.warp(forkTimestamp);
        }
    }
}
