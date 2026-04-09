// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Proxies, Tokens, Vaults} from "tests/utils/Artifacts.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

// --- Project imports
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {MockNonRebasing} from "contracts/mocks/MockNonRebasing.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";

abstract contract Unit_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint256 internal constant DELAY_PERIOD = 600; // 10 minutes
    uint256 internal constant REBASE_RATE_MAX = 200e18; // 200% APR

    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    IOToken internal ousd;
    IVault internal ousdVault;
    IProxy internal ousdProxy;
    IProxy internal ousdVaultProxy;

    MockStrategy internal mockStrategy;
    MockNonRebasing internal mockNonRebasing;

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
        IOToken ousdImpl = IOToken(vm.deployCode(Tokens.OUSD, abi.encode(address(usdc))));
        address ousdVaultImpl = vm.deployCode(Vaults.OUSD, abi.encode(address(usdc)));

        // -- Deploy Proxies
        ousdProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        ousdVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

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
        ousd = IOToken(address(ousdProxy));
        ousdVault = IVault(address(ousdVaultProxy));

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

    /// @dev Deploy a MockStrategy, approve it on the vault, and configure withdrawAll
    function _deployAndApproveStrategy() internal returns (MockStrategy strategy) {
        strategy = new MockStrategy();
        strategy.setWithdrawAll(address(usdc), address(ousdVault));

        vm.prank(governor);
        ousdVault.approveStrategy(address(strategy));
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
        vm.label(address(mockStrategy), "MockStrategy");
        vm.label(address(mockNonRebasing), "MockNonRebasing");
    }
}
