// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Base } from "tests/Base.t.sol";
import { Oracles } from "tests/utils/artifacts/Oracles.sol";

import { IOTokenVaultOracle } from "contracts/interfaces/IOTokenVaultOracle.sol";
import {
    MockOTokenVaultOracleToken,
    MockOTokenVaultOracleVault
} from "tests/mocks/MockOTokenVaultOracleDependencies.sol";

abstract contract Unit_OTokenVaultOracle_Shared_Test is Base {
    IOTokenVaultOracle internal oracle;
    MockOTokenVaultOracleVault internal mockVault;
    MockOTokenVaultOracleToken internal mockOToken;

    function setUp() public virtual override {
        super.setUp();
        vm.warp(7 days);
        _deployMockContracts();
        _deployContracts();
        _configureContracts();
        _fundInitialUsers();
        label();
    }

    function _deployMockContracts() internal {
        mockVault = new MockOTokenVaultOracleVault();
        mockOToken = new MockOTokenVaultOracleToken();
        mockVault.setOToken(address(mockOToken));
    }

    function _deployContracts() internal {
        oracle = IOTokenVaultOracle(
            vm.deployCode(
                Oracles.O_TOKEN_VAULT_ORACLE,
                abi.encode(
                    address(mockVault),
                    "OToken / underlying asset"
                )
            )
        );
    }

    function _configureContracts() internal {
        mockVault.setTotalValue(100e18);
        mockOToken.setTotalSupply(100e18);
    }

    function _fundInitialUsers() internal {}

    function label() public {
        vm.label(address(oracle), "OTokenVaultOracle");
        vm.label(address(mockVault), "MockVault");
        vm.label(address(mockOToken), "MockOToken");
    }
}
