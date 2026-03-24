// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {OUSD} from "contracts/token/OUSD.sol";
import {OUSDVault} from "contracts/vault/OUSDVault.sol";
import {OUSDProxy} from "contracts/proxies/Proxies.sol";
import {VaultProxy} from "contracts/proxies/Proxies.sol";
import {MockNonRebasing} from "contracts/mocks/MockNonRebasing.sol";

abstract contract Unit_OUSD_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////
    OUSD internal ousd;
    OUSDVault internal ousdVault;
    OUSDProxy internal ousdProxy;
    VaultProxy internal ousdVaultProxy;

    MockNonRebasing internal mockNonRebasing;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////
    uint256 internal constant DELAY_PERIOD = 600; // 10 minutes
    uint256 internal constant REBASE_RATE_MAX = 200e18; // 200% APR

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////
    function setUp() public virtual override {
        super.setUp();

        // Set a reasonable starting timestamp so rebase per-second caps work
        vm.warp(7 days);

        _deployMockContracts();
        _deployContracts();
        _configureContracts();
        _fundInitialUsers();
        label();
    }

    function _deployMockContracts() internal {
        usdc = IERC20(address(new MockERC20("USD Coin", "USDC", 6)));

        mockNonRebasing = new MockNonRebasing();
        mockNonRebasing.setOUSD(address(0)); // Will be set after OUSD is deployed
    }

    function _deployContracts() internal {
        vm.startPrank(deployer);

        // -- Deploy implementations
        OUSD ousdImpl = new OUSD();
        OUSDVault ousdVaultImpl = new OUSDVault(address(usdc));

        // -- Deploy Proxies
        ousdProxy = new OUSDProxy();
        ousdVaultProxy = new VaultProxy();

        // -- Initialize OUSD Proxy
        ousdProxy.initialize(
            address(ousdImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(ousdVaultProxy), 1e27)
        );

        // -- Initialize Vault Proxy
        ousdVaultProxy.initialize(
            address(ousdVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(ousdProxy))
        );

        vm.stopPrank();

        // -- Cast proxies to their types
        ousd = OUSD(address(ousdProxy));
        ousdVault = OUSDVault(address(ousdVaultProxy));

        // -- Configure MockNonRebasing with deployed OUSD
        mockNonRebasing.setOUSD(address(ousd));
    }

    function _configureContracts() internal {
        vm.startPrank(governor);
        ousdVault.unpauseCapital();
        ousdVault.setStrategistAddr(strategist);
        ousdVault.setMaxSupplyDiff(5e16); // 5%
        ousdVault.setWithdrawalClaimDelay(DELAY_PERIOD);
        ousdVault.setDripDuration(0); // Disable drip smoothing for instant rebase in tests
        ousdVault.setRebaseRateMax(REBASE_RATE_MAX);
        vm.stopPrank();
    }

    /// @dev Fund matt and josh with 100 OUSD each (matching Hardhat fixture's 200 OUSD total supply)
    function _fundInitialUsers() internal {
        _mintOUSD(matt, 100e6);
        _mintOUSD(josh, 100e6);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Mint USDC to an address
    function _dealUSDC(address to, uint256 amount) internal {
        MockERC20(address(usdc)).mint(to, amount);
    }

    /// @dev Deal USDC, approve vault, and mint OUSD for a user
    function _mintOUSD(address user, uint256 usdcAmount) internal {
        _dealUSDC(user, usdcAmount);
        vm.startPrank(user);
        usdc.approve(address(ousdVault), usdcAmount);
        ousdVault.mint(usdcAmount);
        vm.stopPrank();
    }

    /// @dev Deal USDC to vault as yield, warp 1 second, then call vault.rebase()
    function _rebase(uint256 yieldUSDC) internal {
        _dealUSDC(address(ousdVault), yieldUSDC);
        vm.warp(block.timestamp + 1);
        vm.prank(governor);
        ousdVault.rebase();
    }

    /// @dev Call ousd.changeSupply() directly from the vault address
    function _changeSupply(uint256 newTotalSupply) internal {
        vm.prank(address(ousdVault));
        ousd.changeSupply(newTotalSupply);
    }

    /// @dev Assert the supply invariant: rebasingSupply + nonRebasingSupply ≈ totalSupply
    function _assertSupplyInvariant() internal view {
        uint256 calculatedSupply =
            (ousd.rebasingCreditsHighres() * 1e18) / ousd.rebasingCreditsPerTokenHighres() + ousd.nonRebasingSupply();
        assertApproxEqAbs(calculatedSupply, ousd.totalSupply(), 1);
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////
    function label() public {
        vm.label(address(usdc), "USDC");
        vm.label(address(ousd), "OUSD");
        vm.label(address(ousdVault), "OUSDVault");
        vm.label(address(ousdProxy), "OUSDProxy");
        vm.label(address(ousdVaultProxy), "OUSDVaultProxy");
        vm.label(address(mockNonRebasing), "MockNonRebasing");
    }
}
