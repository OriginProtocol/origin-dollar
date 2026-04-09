// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Proxies, Tokens, Vaults, Zappers} from "tests/utils/Artifacts.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IWOToken} from "contracts/interfaces/IWOToken.sol";
import {IOETHZapper} from "contracts/interfaces/IOETHZapper.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";

abstract contract Unit_OETHZapper_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////
    IOToken internal oeth;
    IVault internal oethVault;
    IProxy internal oethProxy;
    IProxy internal oethVaultProxy;
    IWOToken internal woeth;
    IProxy internal woethProxy;
    IOETHZapper internal oethZapper;
    IOETHZapper internal oethBaseZapper;
    MockWETH internal mockWeth;

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

        address oethImpl = vm.deployCode(Tokens.OETH);
        address oethVaultImpl = vm.deployCode(Vaults.OETH, abi.encode(address(weth)));

        oethProxy = IProxy(vm.deployCode(Proxies.OETH_PROXY));
        oethVaultProxy = IProxy(vm.deployCode(Proxies.OETH_VAULT_PROXY));

        oethProxy.initialize(
            oethImpl, governor, abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            oethVaultImpl, governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oeth = IOToken(address(oethProxy));
        oethVault = IVault(address(oethVaultProxy));
    }

    function _deployWOETH() internal {
        vm.startPrank(deployer);

        address woethImpl = vm.deployCode(Tokens.WOETH, abi.encode(ERC20(address(oeth))));
        woethProxy = IProxy(vm.deployCode(Proxies.WOETH_PROXY));
        woethProxy.initialize(woethImpl, governor, "");

        vm.stopPrank();

        woeth = IWOToken(address(woethProxy));

        vm.prank(governor);
        woeth.initialize();
    }

    function _deployZapper() internal {
        oethZapper = IOETHZapper(
            vm.deployCode(
                Zappers.OETH_ZAPPER, abi.encode(address(oeth), address(woeth), address(oethVault), address(weth))
            )
        );
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
