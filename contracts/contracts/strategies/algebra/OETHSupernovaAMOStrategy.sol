// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Supernova OETH Algorithmic Market Maker (AMO) Strategy
 * @notice AMO strategy for the Supernova OETH/WETH stable pool
 * @author Origin Protocol Inc
 */
import { StableSwapAMMStrategy } from "./StableSwapAMMStrategy.sol";
import { IGauge } from "../../interfaces/algebra/IAlgebraGauge.sol";

contract OETHSupernovaAMOStrategy is StableSwapAMMStrategy {
    /**
     * @param _baseConfig The `platformAddress` is the address of the Supernova OETH/WETH pool.
     * The `vaultAddress` is the address of the OETH Vault.
     * @param _gauge Address of the Supernova gauge for the pool.
     */
    constructor(BaseStrategyConfig memory _baseConfig, address _gauge)
        StableSwapAMMStrategy(_baseConfig, _gauge, IGauge(_gauge).TOKEN())
    {}
}
