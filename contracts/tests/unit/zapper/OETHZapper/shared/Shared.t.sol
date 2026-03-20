// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {OETHProxy} from "contracts/proxies/Proxies.sol";
import {OETHVaultProxy} from "contracts/proxies/Proxies.sol";
import {WOETHProxy} from "contracts/proxies/Proxies.sol";
import {WOETH} from "contracts/token/WOETH.sol";
import {OETHZapper} from "contracts/zapper/OETHZapper.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";

abstract contract Unit_OETHZapper_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////
    address internal constant ETH_MARKER = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////
    function setUp() public virtual override {
        super.setUp();

        vm.warp(7 days);

        _deployMockContracts();
        _deployContracts();
        _deployWOETH();
        _deployZapper();
        _configureContracts();
        label();
    }

    function _deployMockContracts() internal {
        mockWeth = new MockWETH();
        weth = IERC20(address(mockWeth));
    }

    function _deployContracts() internal {
        vm.startPrank(deployer);

        OETH oethImpl = new OETH();
        OETHVault oethVaultImpl = new OETHVault(address(weth));

        oethProxy = new OETHProxy();
        oethVaultProxy = new OETHVaultProxy();

        oethProxy.initialize(
            address(oethImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oeth = OETH(address(oethProxy));
        oethVault = OETHVault(address(oethVaultProxy));
    }

    function _deployWOETH() internal {
        vm.startPrank(deployer);

        WOETH woethImpl = new WOETH(ERC20(address(oeth)));
        woethProxy = new WOETHProxy();
        woethProxy.initialize(address(woethImpl), governor, "");

        vm.stopPrank();

        woeth = WOETH(address(woethProxy));

        vm.prank(governor);
        woeth.initialize();
    }

    function _deployZapper() internal {
        oethZapper = new OETHZapper(address(oeth), address(woeth), address(oethVault), address(weth));
    }

    function _configureContracts() internal {
        vm.startPrank(governor);
        oethVault.unpauseCapital();
        oethVault.setStrategistAddr(strategist);
        oethVault.setMaxSupplyDiff(5e16);
        oethVault.setWithdrawalClaimDelay(600);
        oethVault.setDripDuration(0);
        oethVault.setRebaseRateMax(200e18);
        vm.stopPrank();
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal ETH to an address
    function _dealETH(address to, uint256 amount) internal {
        vm.deal(to, amount);
    }

    /// @dev Deal WETH to an address by depositing ETH
    function _dealWETH(address to, uint256 amount) internal {
        vm.deal(to, amount);
        vm.prank(to);
        mockWeth.deposit{value: amount}();
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////
    function label() public {
        vm.label(address(weth), "WETH");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(woeth), "WOETH");
        vm.label(address(oethZapper), "OETHZapper");
    }
}
