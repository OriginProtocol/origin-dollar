// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";
import {Vaults} from "tests/utils/artifacts/Vaults.sol";

// Interfaces
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Mocks
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";
import {MockNonRebasing} from "contracts/mocks/MockNonRebasing.sol";

abstract contract Unit_OETHVault_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////
    IOToken internal oeth;
    IVault internal oethVault;
    IProxy internal oethProxy;
    IProxy internal oethVaultProxy;

    MockStrategy internal mockStrategy;
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
        weth = IERC20(address(new MockERC20("Wrapped Ether", "WETH", 18)));

        mockNonRebasing = new MockNonRebasing();
        mockNonRebasing.setOUSD(address(0)); // Will be set after OETH is deployed
    }

    function _deployContracts() internal {
        vm.startPrank(deployer);

        // -- Deploy implementations
        IOToken oethImpl = IOToken(vm.deployCode(Tokens.OETH));
        address oethVaultImpl = vm.deployCode(Vaults.OETH, abi.encode(address(weth)));

        // -- Deploy Proxies
        oethProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        oethVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        // -- Initialize OETH Proxy
        oethProxy.initialize(
            address(oethImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        // -- Initialize Vault Proxy
        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        // -- Cast proxies to their types
        oeth = IOToken(address(oethProxy));
        oethVault = IVault(address(oethVaultProxy));

        // -- Configure MockNonRebasing with deployed OETH
        mockNonRebasing.setOUSD(address(oeth));
    }

    function _configureContracts() internal {
        vm.startPrank(governor);
        oethVault.unpauseCapital();
        oethVault.setStrategistAddr(strategist);
        oethVault.setMaxSupplyDiff(5e16); // 5%
        oethVault.setWithdrawalClaimDelay(DELAY_PERIOD);
        oethVault.setDripDuration(0); // Disable drip smoothing for instant rebase in tests
        oethVault.setRebaseRateMax(REBASE_RATE_MAX);
        vm.stopPrank();
    }

    /// @dev Fund matt and josh with 100 OETH each (matching Hardhat fixture's 200 OETH total supply)
    function _fundInitialUsers() internal {
        _mintOETH(matt, 100e18);
        _mintOETH(josh, 100e18);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Mint WETH to an address
    function _dealWETH(address to, uint256 amount) internal {
        MockERC20(address(weth)).mint(to, amount);
    }

    /// @dev Deal WETH, approve vault, and mint OETH for a user
    function _mintOETH(address user, uint256 wethAmount) internal {
        _dealWETH(user, wethAmount);
        vm.startPrank(user);
        weth.approve(address(oethVault), wethAmount);
        oethVault.mint(wethAmount);
        vm.stopPrank();
    }

    /// @dev Deploy a MockStrategy, approve it on the vault, and configure withdrawAll
    function _deployAndApproveStrategy() internal returns (MockStrategy strategy) {
        strategy = new MockStrategy();
        strategy.setWithdrawAll(address(weth), address(oethVault));

        vm.prank(governor);
        oethVault.approveStrategy(address(strategy));
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////
    function label() public {
        vm.label(address(weth), "WETH");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(oethProxy), "OETHProxy");
        vm.label(address(oethVaultProxy), "OETHVaultProxy");
        vm.label(address(mockStrategy), "MockStrategy");
        vm.label(address(mockNonRebasing), "MockNonRebasing");
    }
}
