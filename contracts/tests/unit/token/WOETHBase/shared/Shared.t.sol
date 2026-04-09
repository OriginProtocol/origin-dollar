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
import {IWOToken} from "contracts/interfaces/IWOToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Mocks
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

abstract contract Unit_WOETHBase_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////
    IOToken internal oethBase;
    IVault internal oethVault;
    IProxy internal oethProxy;
    IProxy internal oethVaultProxy;

    IWOToken internal woethBase;
    IProxy internal woethBaseProxy;

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

        IOToken oethBaseImpl = IOToken(vm.deployCode(Tokens.OETH_BASE));
        address oethVaultImpl = vm.deployCode(Vaults.OETH, abi.encode(address(weth)));

        oethProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        oethVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        oethProxy.initialize(
            address(oethBaseImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oethBase = IOToken(address(oethProxy));
        oethVault = IVault(address(oethVaultProxy));
    }

    function _deployWOETHBase() internal {
        vm.startPrank(deployer);

        address woethBaseImpl = vm.deployCode(Tokens.WOETH_BASE, abi.encode(address(oethBase)));
        woethBaseProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        woethBaseProxy.initialize(address(woethBaseImpl), governor, "");

        vm.stopPrank();

        woethBase = IWOToken(address(woethBaseProxy));

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
