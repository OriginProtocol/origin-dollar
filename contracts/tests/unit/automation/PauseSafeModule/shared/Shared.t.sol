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
import {IPauseSafeModule} from "contracts/interfaces/automation/IPauseSafeModule.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Mocks
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {MockPausableARM} from "tests/mocks/MockPausableARM.sol";

abstract contract Unit_PauseSafeModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    MockSafeContract internal mockSafe;
    IPauseSafeModule internal pauseSafeModule;

    IOToken internal oeth;
    IVault internal oethVault;

    /// @dev A second vault, deliberately left off the module's allow-list.
    IOToken internal otherOeth;
    IVault internal unlistedVault;

    /// @dev An ARM-shaped target: no-argument `pause()`, guardian can pause,
    ///      only the admin multisig can unpause.
    MockPausableARM internal arm;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        _configureContracts();
        label();
    }

    function _deployContracts() internal {
        mockSafe = new MockSafeContract();
        weth = IERC20(address(new MockERC20("Wrapped Ether", "WETH", 18)));

        (oeth, oethVault) = _deployOethVault();
        (otherOeth, unlistedVault) = _deployOethVault();

        // The Safe hosting the module is the ARM's guardian, exactly as
        // arm-oeth deploy script 043 wires it on mainnet.
        arm = new MockPausableARM(address(mockSafe), guardian);

        // `unlistedVault` is left off so tests can prove the module refuses
        // targets the Safe never approved.
        address[] memory initialTargets = new address[](2);
        initialTargets[0] = address(oethVault);
        initialTargets[1] = address(arm);

        address[] memory operators = new address[](1);
        operators[0] = operator;

        pauseSafeModule = IPauseSafeModule(
            vm.deployCode(Automation.PAUSE_SAFE_MODULE, abi.encode(address(mockSafe), operators, initialTargets))
        );
    }

    /// @dev Deploy an OETH token + vault pair behind fresh proxies.
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
        _configureVault(unlistedVault);
    }

    /// @dev Wire a vault the way production wires it: the Safe hosting the module
    ///      is the Strategist, which is what authorizes `pauseCapital`/`pauseRebase`.
    ///      A separate Admin holds unpause, so the module's Safe can pause but can
    ///      never lift what it paused — the property this module exists to preserve.
    ///      Both flags start unpaused so tests can observe them being tripped.
    function _configureVault(IVault vault) internal {
        vm.startPrank(governor);
        vault.unpauseCapital();
        vault.setStrategistAddr(address(mockSafe));
        vault.setAdminAddr(guardian);
        vm.stopPrank();
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(address(pauseSafeModule), "PauseSafeModule");
        vm.label(address(weth), "WETH");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(unlistedVault), "UnlistedVault");
        vm.label(address(arm), "MockPausableARM");
    }
}
