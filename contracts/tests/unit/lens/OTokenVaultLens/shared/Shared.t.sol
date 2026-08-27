// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Lens} from "tests/utils/artifacts/Lens.sol";
import {Proxies} from "tests/utils/artifacts/Proxies.sol";

// Interfaces
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IOTokenVaultLens} from "contracts/interfaces/IOTokenVaultLens.sol";

// Mocks
import {
    MockOTokenVaultLensStrategy,
    MockOTokenVaultLensToken,
    MockOTokenVaultLensVault
} from "tests/mocks/MockOTokenVaultLensDependencies.sol";

abstract contract Unit_OTokenVaultLens_Shared_Test is Base {
    IOTokenVaultLens internal lens;
    IProxy internal lensProxy;
    address internal lensImpl;
    MockOTokenVaultLensVault internal mockVault;
    MockOTokenVaultLensToken internal mockOToken;
    MockOTokenVaultLensStrategy internal mockStrategy;

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
        mockVault = new MockOTokenVaultLensVault();
        mockOToken = new MockOTokenVaultLensToken();
        mockStrategy = new MockOTokenVaultLensStrategy();
        mockVault.setOToken(address(mockOToken));
    }

    function _deployContracts() internal {
        (lens, lensProxy, lensImpl) = _deployLens(address(mockStrategy));
    }

    /// @dev Deploys an OTokenVaultLens implementation behind a fresh governed proxy.
    function _deployLens(address strategy) internal returns (IOTokenVaultLens lens_, IProxy proxy_, address impl_) {
        vm.startPrank(deployer);
        impl_ = vm.deployCode(Lens.O_TOKEN_VAULT_LENS, abi.encode(address(mockVault), strategy));
        proxy_ = IProxy(vm.deployCode(Proxies.IG_PROXY));
        proxy_.initialize(impl_, governor, "");
        vm.stopPrank();
        lens_ = IOTokenVaultLens(address(proxy_));
    }

    function _configureContracts() internal {
        mockVault.setTotalValue(100e18);
        mockOToken.setTotalSupply(100e18);
        mockStrategy.setLastVerifiedBalanceTimestamp(uint64(block.timestamp));
    }

    function label() public {
        vm.label(address(lens), "OTokenVaultLens");
        vm.label(address(mockVault), "MockVault");
        vm.label(address(mockOToken), "MockOToken");
        vm.label(address(mockStrategy), "MockStakingStrategy");
    }
}
