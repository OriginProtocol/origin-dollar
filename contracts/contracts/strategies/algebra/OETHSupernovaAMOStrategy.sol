// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Supernova OETH Algorithmic Market Maker (AMO) Strategy
 * @notice AMO strategy for the Supernova OETH/WETH stable pool
 * @author Origin Protocol Inc
 */
import { StableSwapAMMStrategy } from "./StableSwapAMMStrategy.sol";

contract OETHSupernovaAMOStrategy is StableSwapAMMStrategy {
    /**
     * @param _baseConfig The `platformAddress` is the address of the Supernova OETH/WETH pool.
     * The `vaultAddress` is the address of the OETH Vault.
     * @param _oeth Address of the OETH token.
     * @param _weth Address of the WETH token.
     * @param _gauge Address of the Supernova gauge for the pool.
     */
    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _oeth,
        address _weth,
        address _gauge
    ) StableSwapAMMStrategy(_baseConfig, _oeth, _weth, _gauge) {}
}
