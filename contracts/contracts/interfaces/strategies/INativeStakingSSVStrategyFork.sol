// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { INativeStakingSSVStrategy } from "./INativeStakingSSVStrategy.sol";

interface INativeStakingSSVStrategyFork is INativeStakingSSVStrategy {
    function requestConsolidation(
        bytes[] calldata sourcePubKeys,
        bytes calldata targetPubKey
    ) external payable;
}
