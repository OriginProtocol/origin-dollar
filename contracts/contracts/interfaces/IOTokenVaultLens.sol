// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IOToken } from "./IOToken.sol";
import { IVault } from "./IVault.sol";

/**
 * @title OToken Vault Lens Interface
 * @author Origin Protocol Inc
 */
interface IOTokenVaultLens {
    /**
     * @notice Returns the Vault used to calculate the OToken rate.
     * @return The Vault contract.
     */
    function vault() external view returns (IVault);

    /**
     * @notice Returns the OToken whose rate is reported.
     * @return The OToken contract.
     */
    function oToken() external view returns (IOToken);

    /**
     * @notice Returns the staking strategy whose verified balance freshness gates getRate.
     * @return The staking strategy address. address(0) disables the staleness check.
     */
    function stakingStrategy() external view returns (address);

    /**
     * @notice Returns the maximum age of the staking strategy's last verified balance
     *         before getRate reverts.
     * @return The maximum age in seconds.
     */
    function MAX_VERIFIED_BALANCE_AGE() external view returns (uint256);

    /**
     * @notice Returns the value of one OToken in the Vault's underlying asset.
     * @return The rate with 18 decimals.
     */
    function getRate() external view returns (uint256);
}
