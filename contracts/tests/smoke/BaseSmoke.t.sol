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

    function _igniteDeployManager() internal {
        deployManager = new DeployManager();
        deployManager.setUp();
        deployManager.run();
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
