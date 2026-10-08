// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OETHb Hydrex Algorithmic Market Maker (AMO) Strategy
 * @notice AMO strategy for the Hydrex superOETHb/WETH stable pool on Base
 * @author Origin Protocol Inc
 */
import { StableSwapAMMStrategy } from "../algebra/StableSwapAMMStrategy.sol";
import { IHydrexGauge } from "../../interfaces/hydrex/IHydrexGauge.sol";

contract OETHbHydrexAMOStrategy is StableSwapAMMStrategy {
    /**
     * @param _baseConfig The `platformAddress` is the address of the Hydrex superOETHb/WETH pool.
     * The `vaultAddress` is the address of the OETHBase Vault.
     * @param _gauge Address of the Hydrex gauge for the pool. Hydrex GaugeV2
     *        (>= v2.5) renamed `TOKEN()` to `stakeToken()`, which is what we
     *        resolve here and forward to the parent.
     */
    constructor(BaseStrategyConfig memory _baseConfig, address _gauge)
        StableSwapAMMStrategy(
            _baseConfig,
            _gauge,
            IHydrexGauge(_gauge).stakeToken()
        )
    {}
}
