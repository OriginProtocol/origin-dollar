// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AggregatorV3Interface } from "./chainlink/AggregatorV3Interface.sol";
import { IOToken } from "./IOToken.sol";
import { IVault } from "./IVault.sol";

/**
 * @title OToken Vault Oracle Interface
 * @author Origin Protocol Inc
 */
interface IOTokenVaultOracle is AggregatorV3Interface {
    /**
     * @notice Returns the Vault used to calculate the OToken price.
     * @return The Vault contract.
     */
    function vault() external view returns (IVault);

    /**
     * @notice Returns the OToken whose price is reported.
     * @return The OToken contract.
     */
    function oToken() external view returns (IOToken);

    /**
     * @notice Returns the value of one OToken in the Vault's underlying asset.
     * @return The price with 18 decimals.
     */
    function price() external view returns (uint256);

    /**
     * @notice Returns the latest price using the legacy Chainlink interface.
     * @return The price with 18 decimals.
     */
    function latestAnswer() external view returns (int256);
}
