// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.sol";

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {OSonic} from "contracts/token/OSonic.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {OETHProxy} from "contracts/proxies/Proxies.sol";
import {OETHVaultProxy} from "contracts/proxies/Proxies.sol";
import {WOETHProxy} from "contracts/proxies/Proxies.sol";
import {WOSonic} from "contracts/token/WOSonic.sol";
import {OSonicZapper} from "contracts/zapper/OSonicZapper.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";

abstract contract Unit_OSonicZapper_Shared_Test is Base {
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

        OSonic oSonicImpl = new OSonic();
        OETHVault vaultImpl = new OETHVault(WS_ADDRESS);

        oethProxy = new OETHProxy();
        oethVaultProxy = new OETHVaultProxy();

        oethProxy.initialize(
            address(oSonicImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            address(vaultImpl),
            governor,
            abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oSonic = OSonic(address(oethProxy));
        oethVault = OETHVault(address(oethVaultProxy));
    }

    function _deployWOSonic() internal {
        vm.startPrank(deployer);

        WOSonic woSonicImpl = new WOSonic(ERC20(address(oSonic)));
        woSonicProxy = new WOETHProxy();
        woSonicProxy.initialize(address(woSonicImpl), governor, "");

        vm.stopPrank();

        woSonic = WOSonic(address(woSonicProxy));

        vm.prank(governor);
        woSonic.initialize();
    }

    function _deployZapper() internal {
        oSonicZapper = new OSonicZapper(
            address(oSonic),
            address(woSonic),
            address(oethVault)
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
