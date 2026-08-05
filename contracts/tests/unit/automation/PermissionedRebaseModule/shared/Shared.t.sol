// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";
import {Vaults} from "tests/utils/artifacts/Vaults.sol";

// --- Project imports
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IPermissionedRebaseModule} from "contracts/interfaces/automation/IPermissionedRebaseModule.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Mocks
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";

abstract contract Unit_PermissionedRebaseModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    MockSafeContract internal mockSafe;
    IPermissionedRebaseModule internal permissionedRebaseModule;

    IOToken internal oeth;
    IVault internal oethVault;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint256 internal constant REBASE_RATE_MAX = 200e18; // 200% APR

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        // Set a reasonable starting timestamp so rebase per-second caps work
        vm.warp(7 days);

        _deployContracts();
        _configureContracts();
        _fundInitialUsers();
        label();
    }

    function _deployContracts() internal {
        mockSafe = new MockSafeContract();
        weth = IERC20(address(new MockERC20("Wrapped Ether", "WETH", 18)));

        (oeth, oethVault) = _deployOethVault();

        address[] memory initialVaults = new address[](1);
        initialVaults[0] = address(oethVault);

        permissionedRebaseModule = IPermissionedRebaseModule(
            vm.deployCode(Automation.PERMISSIONED_REBASE_MODULE, abi.encode(address(mockSafe), operator, initialVaults))
        );
    }

    /// @dev Deploy an OETH token + vault pair behind fresh proxies. Exposed so
    ///      tests can stand up a second vault and exercise the module's loop.
    function _deployOethVault() internal returns (IOToken token, IVault vault) {
        vm.startPrank(deployer);

        IOToken oethImpl = IOToken(vm.deployCode(Tokens.OETH));
        address oethVaultImpl = vm.deployCode(Vaults.OETH, abi.encode(address(weth)));

        IProxy oethProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        IProxy oethVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        oethProxy.initialize(
            address(oethImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );
        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        token = IOToken(address(oethProxy));
        vault = IVault(address(oethVaultProxy));
    }

    function _configureContracts() internal {
        _configureVault(oethVault);
    }

    /// @dev Wire a vault the way production wires it for this module: the Safe is
    ///      the Strategist. `pauseRebase`/`unpauseRebase` are onlyGovernorOrStrategist
    ///      and `rebase` accepts the Strategist, so that single role lets the module
    ///      drive the whole unpause->rebase->pause sequence. The vault is then left
    ///      rebase-paused, which is the module's premise.
    function _configureVault(IVault vault) internal {
        vm.startPrank(governor);
        vault.unpauseCapital();
        vault.setStrategistAddr(address(mockSafe));
        vault.setDripDuration(0); // Disable drip smoothing for instant rebase in tests
        vault.setRebaseRateMax(REBASE_RATE_MAX); // Without this the per-second cap clamps yield to 0
        vault.pauseRebase();
        vm.stopPrank();
    }

    /// @dev Give the vault a non-zero rebasing supply so a rebase can distribute yield
    function _fundInitialUsers() internal {
        _fundVault(oethVault);
    }

    function _fundVault(IVault vault) internal {
        _mintOETH(vault, matt, 100e18);
        _mintOETH(vault, josh, 100e18);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _dealWETH(address to, uint256 amount) internal {
        MockERC20(address(weth)).mint(to, amount);
    }

    function _mintOETH(IVault vault, address user, uint256 wethAmount) internal {
        _dealWETH(user, wethAmount);
        vm.startPrank(user);
        weth.approve(address(vault), wethAmount);
        vault.mint(wethAmount);
        vm.stopPrank();
    }

    /// @dev Send WETH straight to the vault so `rebase()` has yield to distribute
    function _injectYield(uint256 amount) internal {
        _injectYield(oethVault, amount);
    }

    function _injectYield(IVault vault, uint256 amount) internal {
        _dealWETH(address(vault), amount);
        vm.warp(block.timestamp + 1);
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(address(permissionedRebaseModule), "PermissionedRebaseModule");
        vm.label(address(weth), "WETH");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
    }
}
