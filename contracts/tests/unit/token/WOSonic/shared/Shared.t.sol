// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";
import {Vaults} from "tests/utils/artifacts/Vaults.sol";

// --- External libraries
// Interfaces
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IWOToken} from "contracts/interfaces/IWOToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Mocks
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

abstract contract Unit_WOSonic_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////
    IOToken internal oSonic;
    IVault internal oethVault;
    IProxy internal oethProxy;
    IProxy internal oethVaultProxy;

    IWOToken internal woSonic;
    IProxy internal woSonicProxy;

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
        _deployWOSonic();
        _configureContracts();
        _fundInitialUsers();
        label();
    }

    function _deployMockContracts() internal {
        // wS (wrapped Sonic) is 18 decimals, like WETH
        weth = IERC20(address(new MockERC20("Wrapped Sonic", "wS", 18)));
    }

    function _deployContracts() internal {
        vm.startPrank(deployer);

        IOToken oSonicImpl = IOToken(vm.deployCode(Tokens.OS));
        address oethVaultImpl = vm.deployCode(Vaults.OETH, abi.encode(address(weth)));

        oethProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        oethVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        oethProxy.initialize(
            address(oSonicImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oSonic = IOToken(address(oethProxy));
        oethVault = IVault(address(oethVaultProxy));
    }

    function _deployWOSonic() internal {
        vm.startPrank(deployer);

        address woSonicImpl = vm.deployCode(Tokens.WOSONIC, abi.encode(address(oSonic)));
        woSonicProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        woSonicProxy.initialize(address(woSonicImpl), governor, "");

        vm.stopPrank();

        woSonic = IWOToken(address(woSonicProxy));

        vm.prank(governor);
        woSonic.initialize();
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
        _mintOSonic(matt, 100e18);
        _mintOSonic(josh, 100e18);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _dealWS(address to, uint256 amount) internal {
        MockERC20(address(weth)).mint(to, amount);
    }

    function _mintOSonic(address user, uint256 wsAmount) internal {
        _dealWS(user, wsAmount);
        vm.startPrank(user);
        weth.approve(address(oethVault), wsAmount);
        oethVault.mint(wsAmount);
        vm.stopPrank();
    }

    function _depositToWOSonic(address user, uint256 osAmount) internal returns (uint256 shares) {
        vm.startPrank(user);
        IERC20(address(oSonic)).approve(address(woSonic), osAmount);
        shares = woSonic.deposit(osAmount, user);
        vm.stopPrank();
    }

    function _mintAndDeposit(address user, uint256 wsAmount) internal returns (uint256 shares) {
        _mintOSonic(user, wsAmount);
        shares = _depositToWOSonic(user, IERC20(address(oSonic)).balanceOf(user));
    }

    function _rebase(uint256 yieldWS) internal {
        _dealWS(address(oethVault), yieldWS);
        vm.warp(block.timestamp + 1);
        vm.prank(governor);
        oethVault.rebase();
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////
    function label() public {
        vm.label(address(weth), "wS");
        vm.label(address(oSonic), "OSonic");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(woSonic), "WOSonic");
        vm.label(address(woSonicProxy), "WOSonicProxy");
    }
}
