// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Flux Strategy
 * @notice Investment strategy for investing stablecoins via Flux
 * @author Origin Protocol Inc
 */

import { CompoundStrategy } from "./CompoundStrategy.sol";

contract FluxStrategy is CompoundStrategy {
    constructor(BaseStrategyConfig memory _stratConfig)
        CompoundStrategy(_stratConfig)
    {}

    /**
     * @inheritdoc CompoundStrategy
     */
    function collectRewardTokens() external override {
        // Intentionally not adding any modifiers to not increase contract size
        // Flux strategy has no reward tokens
    }
}
