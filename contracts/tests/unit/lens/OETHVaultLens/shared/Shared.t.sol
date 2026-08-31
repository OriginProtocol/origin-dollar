// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Lens} from "tests/utils/artifacts/Lens.sol";
import {Proxies} from "tests/utils/artifacts/Proxies.sol";

// Interfaces
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IOETHVaultLens} from "contracts/interfaces/IOETHVaultLens.sol";

// Mocks
import {
    MockOETHVaultLensStrategy,
    MockOETHVaultLensToken,
    MockOETHVaultLensVault
} from "tests/mocks/MockOETHVaultLensDependencies.sol";

abstract contract Unit_OETHVaultLens_Shared_Test is Base {
    IOETHVaultLens internal lens;
    IProxy internal lensProxy;
    address internal lensImpl;
    MockOETHVaultLensVault internal mockVault;
    MockOETHVaultLensToken internal mockOToken;
    MockOETHVaultLensStrategy internal mockStrategy;

    function setUp() public virtual override {
        super.setUp();
        // block.timestamp must exceed MAX_VERIFIED_BALANCE_AGE so a zero
        // lastVerifiedBalanceTimestamp counts as stale.
        vm.warp(7 days);
        _deployMockContracts();
        _deployContracts();
        _configureContracts();
        label();
    }

    function _deployMockContracts() internal {
        mockVault = new MockOETHVaultLensVault();
        mockOToken = new MockOETHVaultLensToken();
        mockStrategy = new MockOETHVaultLensStrategy();
        mockVault.setOToken(address(mockOToken));
    }

    function _deployContracts() internal {
        vm.startPrank(deployer);
        lensImpl = vm.deployCode(Lens.OETH_VAULT_LENS, abi.encode(address(mockVault), address(mockStrategy)));
        lensProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        lensProxy.initialize(lensImpl, governor, "");
        vm.stopPrank();
        lens = IOETHVaultLens(address(lensProxy));
    }

    function _configureContracts() internal {
        mockVault.setTotalValue(100e18);
        mockOToken.setTotalSupply(100e18);
        mockStrategy.setLastVerifiedBalanceTimestamp(uint64(block.timestamp));
    }

    function label() public {
        vm.label(address(lens), "OETHVaultLens");
        vm.label(address(mockVault), "MockVault");
        vm.label(address(mockOToken), "MockOToken");
        vm.label(address(mockStrategy), "MockStakingStrategy");
    }
}
