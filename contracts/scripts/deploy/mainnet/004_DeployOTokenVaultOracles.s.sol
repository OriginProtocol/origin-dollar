// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {OTokenVaultOracle} from "contracts/oracle/OTokenVaultOracle.sol";
import {AbstractDeployScript} from "scripts/deploy/helpers/AbstractDeployScript.s.sol";

/**
 * @title 004_DeployOTokenVaultOracles
 * @notice Deploys the OETH/WETH and OUSD/USDC Vault Oracles on mainnet.
 * @author Origin Protocol Inc
 */
contract $004_DeployOTokenVaultOracles is AbstractDeployScript("004_DeployOTokenVaultOracles") {
    function _execute() internal override {
        OTokenVaultOracle oethVaultOracle = new OTokenVaultOracle(resolver.resolve("OETH_VAULT_PROXY"), "OETH / WETH");
        OTokenVaultOracle ousdVaultOracle = new OTokenVaultOracle(resolver.resolve("OUSD_VAULT_PROXY"), "OUSD / USDC");

        _recordDeployment("OETH_VAULT_ORACLE", address(oethVaultOracle), type(OTokenVaultOracle).name);
        _recordDeployment("OUSD_VAULT_ORACLE", address(ousdVaultOracle), type(OTokenVaultOracle).name);
    }

    function _fork() internal override {
        _verifyOracle(
            resolver.resolve("OETH_VAULT_ORACLE"),
            resolver.resolve("OETH_VAULT_PROXY"),
            resolver.resolve("OETH_PROXY"),
            "OETH / WETH"
        );
        _verifyOracle(
            resolver.resolve("OUSD_VAULT_ORACLE"),
            resolver.resolve("OUSD_VAULT_PROXY"),
            resolver.resolve("OUSD_PROXY"),
            "OUSD / USDC"
        );
    }

    function _verifyOracle(
        address oracleAddress,
        address vaultAddress,
        address oTokenAddress,
        string memory expectedDescription
    ) internal view {
        OTokenVaultOracle oracle = OTokenVaultOracle(oracleAddress);

        require(address(oracle.vault()) == vaultAddress, "Unexpected Vault");
        require(address(oracle.oToken()) == oTokenAddress, "Unexpected OToken");
        require(oracle.decimals() == 18, "Unexpected decimals");
        require(oracle.version() == 1, "Unexpected version");
        require(
            keccak256(bytes(oracle.description())) == keccak256(bytes(expectedDescription)), "Unexpected description"
        );
        require(oracle.price() > 0, "Invalid price");
    }
}
