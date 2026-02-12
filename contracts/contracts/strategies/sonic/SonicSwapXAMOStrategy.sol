// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title SwapX Algorithmic Market Maker (AMO) Strategy
 * @notice AMO strategy for the SwapX OS/wS stable pool
 * @author Origin Protocol Inc
 */
import { StableSwapAMMStrategy } from "../algebra/StableSwapAMMStrategy.sol";

contract SonicSwapXAMOStrategy is StableSwapAMMStrategy {

    /**
     * @param _baseConfig The `platformAddress` is the address of the SwapX pool.
     * The `vaultAddress` is the address of the Origin Sonic Vault.
     * @param _os Address of the OS token.
     * @param _ws Address of the Wrapped S (wS) token.
     * @param _gauge Address of the SwapX gauge for the pool.
     */
    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _os,
        address _ws,
        address _gauge
    ) StableSwapAMMStrategy(_baseConfig, _os, _ws, _gauge) {
    }
}
