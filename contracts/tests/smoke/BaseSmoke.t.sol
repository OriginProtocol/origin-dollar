// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Project imports
import {AggregatorV3Interface} from "contracts/interfaces/chainlink/AggregatorV3Interface.sol";
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

    /// @dev Restore a forked Chainlink feed's freshness after the governance time-warp.
    ///
    ///      Executing a pending proposal requires jumping past the timelock delay
    ///      (`GovHelper._simulateTimelock`), so `_igniteDeployManager()` moves
    ///      `block.timestamp` forward by hours. A forked feed's `updatedAt` does not move
    ///      with it, so any oracle read afterwards reverts as stale even though the live
    ///      feed would be current. Re-assert the feed's real round id and answer against
    ///      the current clock: only the timestamp the simulation invalidated is repaired,
    ///      so the consuming oracle router and its price bounds still execute for real.
    ///
    ///      Call AFTER `_igniteDeployManager()`. `vm.mockCall` returns fixed data, so a
    ///      test that warps again later must call this again.
    function _refreshChainlinkFeed(address feed) internal {
        (uint80 roundId, int256 answer,,, uint80 answeredInRound) = AggregatorV3Interface(feed).latestRoundData();
        vm.mockCall(
            feed,
            abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
            abi.encode(roundId, answer, block.timestamp, block.timestamp, answeredInRound)
        );
    }
}
