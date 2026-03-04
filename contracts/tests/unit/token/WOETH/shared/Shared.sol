// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {OETHProxy} from "contracts/proxies/Proxies.sol";
import {OETHVaultProxy} from "contracts/proxies/Proxies.sol";
import {WOETHProxy} from "contracts/proxies/Proxies.sol";
import {WOETH} from "contracts/token/WOETH.sol";

abstract contract Unit_WOETH_Shared_Test is Base {
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
        _deployWOETH();
        _configureContracts();
        _fundInitialUsers();
        label();
    }

    function _deployMockContracts() internal {
        weth = IERC20(address(new MockERC20("Wrapped Ether", "WETH", 18)));
    }

    function _deployContracts() internal {
        vm.startPrank(deployer);

        // -- Deploy implementations
        OETH oethImpl = new OETH();
        OETHVault oethVaultImpl = new OETHVault(address(weth));

        // -- Deploy Proxies
        oethProxy = new OETHProxy();
        oethVaultProxy = new OETHVaultProxy();

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
        oeth = OETH(address(oethProxy));
        oethVault = OETHVault(address(oethVaultProxy));
    }

    function _deployWOETH() internal {
        vm.startPrank(deployer);

        // -- Deploy WOETH implementation
        WOETH woethImpl = new WOETH(ERC20(address(oeth)));

        // -- Deploy WOETH Proxy (no init data — initialize() has onlyGovernor)
        woethProxy = new WOETHProxy();
        woethProxy.initialize(address(woethImpl), governor, "");

        vm.stopPrank();

        // -- Cast proxy
        woeth = WOETH(address(woethProxy));

        // -- Governor calls initialize() to enable rebasing and set adjuster
        vm.prank(governor);
        woeth.initialize();
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

    /// @dev Fund matt and josh with 100 OETH each
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

    /// @dev Approve OETH to WOETH and deposit
    function _depositToWOETH(address user, uint256 oethAmount) internal returns (uint256 shares) {
        vm.startPrank(user);
        oeth.approve(address(woeth), oethAmount);
        shares = woeth.deposit(oethAmount, user);
        vm.stopPrank();
    }

    /// @dev Mint OETH then deposit to WOETH in one call
    function _mintAndDeposit(address user, uint256 wethAmount) internal returns (uint256 shares) {
        _mintOETH(user, wethAmount);
        shares = _depositToWOETH(user, oeth.balanceOf(user));
    }

    /// @dev Deal WETH to vault as yield, warp 1 second, then call vault.rebase()
    function _rebase(uint256 yieldWETH) internal {
        _dealWETH(address(oethVault), yieldWETH);
        vm.warp(block.timestamp + 1);
        vm.prank(governor);
        oethVault.rebase();
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
        vm.label(address(woeth), "WOETH");
        vm.label(address(woethProxy), "WOETHProxy");
    }
}
