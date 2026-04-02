// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IWOToken} from "contracts/interfaces/IWOToken.sol";
import {IOSonicZapper} from "contracts/interfaces/IOSonicZapper.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";

abstract contract Unit_OSonicZapper_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////
    IOToken internal oSonic;
    IVault internal oethVault;
    IProxy internal oethProxy;
    IProxy internal oethVaultProxy;
    IWOToken internal woSonic;
    IProxy internal woSonicProxy;
    IOSonicZapper internal oSonicZapper;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////
    address internal constant ETH_MARKER = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address internal constant WS_ADDRESS = 0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////
    function setUp() public virtual override {
        super.setUp();

        vm.warp(7 days);

        _deployMockWS();
        _deployContracts();
        _deployWOSonic();
        _deployZapper();
        _configureContracts();
        label();
    }

    /// @dev Deploy MockWETH and etch its bytecode at the hardcoded wS address
    function _deployMockWS() internal {
        // Deploy MockWETH at a normal address first to get bytecode
        MockWETH mockWethInstance = new MockWETH();
        bytes memory code = address(mockWethInstance).code;

        // Etch the bytecode at the hardcoded wS address
        vm.etch(WS_ADDRESS, code);

        // Fund the wS address with ETH so it can function as a wrapper
        vm.deal(WS_ADDRESS, 1000 ether);

        weth = IERC20(WS_ADDRESS);
    }

    function _deployContracts() internal {
        vm.startPrank(deployer);

        address oSonicImpl = vm.deployCode("contracts/token/OSonic.sol:OSonic");
        address vaultImpl = vm.deployCode("contracts/vault/OETHVault.sol:OETHVault", abi.encode(WS_ADDRESS));

        oethProxy = IProxy(vm.deployCode("contracts/proxies/Proxies.sol:OETHProxy"));
        oethVaultProxy = IProxy(vm.deployCode("contracts/proxies/Proxies.sol:OETHVaultProxy"));

        oethProxy.initialize(
            oSonicImpl, governor, abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            vaultImpl, governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oSonic = IOToken(address(oethProxy));
        oethVault = IVault(address(oethVaultProxy));
    }

    function _deployWOSonic() internal {
        vm.startPrank(deployer);

        address woSonicImpl = vm.deployCode("contracts/token/WOSonic.sol:WOSonic", abi.encode(ERC20(address(oSonic))));
        woSonicProxy = IProxy(vm.deployCode("contracts/proxies/Proxies.sol:WOETHProxy"));
        woSonicProxy.initialize(woSonicImpl, governor, "");

        vm.stopPrank();

        woSonic = IWOToken(address(woSonicProxy));

        vm.prank(governor);
        woSonic.initialize();
    }

    function _deployZapper() internal {
        oSonicZapper = IOSonicZapper(
            vm.deployCode(
                "contracts/zapper/OSonicZapper.sol:OSonicZapper",
                abi.encode(address(oSonic), address(woSonic), address(oethVault))
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

    /// @dev Deal native S (ETH in test) to an address
    function _dealS(address to, uint256 amount) internal {
        vm.deal(to, amount);
    }

    /// @dev Deal wS to an address by depositing S
    function _dealWS(address to, uint256 amount) internal {
        vm.deal(to, amount);
        vm.prank(to);
        MockWETH(WS_ADDRESS).deposit{value: amount}();
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////
    function label() public {
        vm.label(WS_ADDRESS, "wS");
        vm.label(address(oSonic), "OSonic");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(woSonic), "WOSonic");
        vm.label(address(oSonicZapper), "OSonicZapper");
    }
}
