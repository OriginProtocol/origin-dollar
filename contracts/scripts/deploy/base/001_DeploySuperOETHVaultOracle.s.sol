// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { OTokenVaultOracle } from "contracts/oracle/OTokenVaultOracle.sol";
import { AbstractDeployScript } from "scripts/deploy/helpers/AbstractDeployScript.s.sol";

/**
 * @title 001_DeploySuperOETHVaultOracle
 * @notice Deploys the superOETHb/WETH Vault Oracle on Base.
 * @author Origin Protocol Inc
 */
contract $001_DeploySuperOETHVaultOracle is
    AbstractDeployScript("001_DeploySuperOETHVaultOracle")
{
    function _execute() internal override {
        OTokenVaultOracle superOETHVaultOracle = new OTokenVaultOracle(
            resolver.resolve("OETHBASE_VAULT_PROXY"),
            "superOETHb / WETH"
        );

        _recordDeployment(
            "OETHBASE_VAULT_ORACLE",
            address(superOETHVaultOracle)
        );
    }

    function _fork() internal override {
        OTokenVaultOracle oracle = OTokenVaultOracle(
            resolver.resolve("OETHBASE_VAULT_ORACLE")
        );

        require(
            address(oracle.vault()) == resolver.resolve("OETHBASE_VAULT_PROXY"),
            "Unexpected Vault"
        );
        require(
            address(oracle.oToken()) == resolver.resolve("OETHBASE_PROXY"),
            "Unexpected OToken"
        );
        require(oracle.decimals() == 18, "Unexpected decimals");
        require(oracle.version() == 1, "Unexpected version");
        require(
            keccak256(bytes(oracle.description())) ==
                keccak256(bytes("superOETHb / WETH")),
            "Unexpected description"
        );
        require(oracle.price() > 0, "Invalid price");
    }
}
