// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {OETHBase} from "contracts/token/OETHBase.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {OETHProxy} from "contracts/proxies/Proxies.sol";
import {OETHVaultProxy} from "contracts/proxies/Proxies.sol";
import {WOETHProxy} from "contracts/proxies/Proxies.sol";
import {WOETHBase} from "contracts/token/WOETHBase.sol";

abstract contract Unit_WOETHBase_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////
    uint256 internal constant DELAY_PERIOD = 600;
    uint256 internal constant REBASE_RATE_MAX = 200e18;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////
    function setUp() public virtual override {
        super.setUp();
        vm.warp(7 days);

        _deployMockContracts();
        _deployContracts();
        _deployWOETHBase();
        _configureContracts();
        _fundInitialUsers();
        label();
    }

    function _deployMockContracts() internal {
        weth = IERC20(address(new MockERC20("Wrapped Ether", "WETH", 18)));
    }

    function _deployContracts() internal {
        vm.startPrank(deployer);

        OETHBase oethBaseImpl = new OETHBase();
        OETHVault oethVaultImpl = new OETHVault(address(weth));

        oethProxy = new OETHProxy();
        oethVaultProxy = new OETHVaultProxy();

        oethProxy.initialize(
            address(oethBaseImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oethBase = OETHBase(address(oethProxy));
        oethVault = OETHVault(address(oethVaultProxy));
    }

    function _deployWOETHBase() internal {
        vm.startPrank(deployer);

        WOETHBase woethBaseImpl = new WOETHBase(ERC20(address(oethBase)));
        woethBaseProxy = new WOETHProxy();
        woethBaseProxy.initialize(address(woethBaseImpl), governor, "");

        vm.stopPrank();

        woethBase = WOETHBase(address(woethBaseProxy));

        vm.prank(governor);
        woethBase.initialize();
    }

    function _configureContracts() internal {
        vm.startPrank(governor);
        oethVault.unpauseCapital();
        oethVault.setStrategistAddr(strategist);
        oethVault.setMaxSupplyDiff(5e16);
        oethVault.setWithdrawalClaimDelay(DELAY_PERIOD);
        oethVault.setDripDuration(0);
        oethVault.setRebaseRateMax(REBASE_RATE_MAX);
        vm.stopPrank();
    }

    function _fundInitialUsers() internal {
        _mintOETHBase(matt, 100e18);
        _mintOETHBase(josh, 100e18);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _dealWETH(address to, uint256 amount) internal {
        MockERC20(address(weth)).mint(to, amount);
    }

    function _mintOETHBase(address user, uint256 wethAmount) internal {
        _dealWETH(user, wethAmount);
        vm.startPrank(user);
        weth.approve(address(oethVault), wethAmount);
        oethVault.mint(wethAmount);
        vm.stopPrank();
    }

    function _depositToWOETHBase(address user, uint256 oethAmount) internal returns (uint256 shares) {
        vm.startPrank(user);
        IERC20(address(oethBase)).approve(address(woethBase), oethAmount);
        shares = woethBase.deposit(oethAmount, user);
        vm.stopPrank();
    }

    function _mintAndDeposit(address user, uint256 wethAmount) internal returns (uint256 shares) {
        _mintOETHBase(user, wethAmount);
        shares = _depositToWOETHBase(user, IERC20(address(oethBase)).balanceOf(user));
    }

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
        vm.label(address(oethBase), "OETHBase");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(woethBase), "WOETHBase");
        vm.label(address(woethBaseProxy), "WOETHBaseProxy");
    }
}
