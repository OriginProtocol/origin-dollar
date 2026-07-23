// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";
import {CrossChain, Base} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "lib/openzeppelin/interfaces/IERC4626.sol";

// --- Project imports
import {IBaseBridgeHelperModule} from "contracts/interfaces/automation/IBaseBridgeHelperModule.sol";
import {IBridgedWOETHStrategy} from "contracts/interfaces/strategies/IBridgedWOETHStrategy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IWETH9} from "contracts/interfaces/IWETH9.sol";

abstract contract Fork_BaseBridgeHelperModule_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IOToken internal oethBase;
    IBridgedWOETHStrategy internal bridgedWOETHStrategy;
    IBaseBridgeHelperModule internal baseBridgeHelperModule;
    IVault internal vault;
    IERC4626 internal bridgedWoeth;

    //////////////////////////////////////////////////////
    /// --- ADDRESSES
    //////////////////////////////////////////////////////

    address internal safeSigner;
    address internal baseGovernor;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkBase();
        _loadForkContracts();
        _deployModule();
        _enableModuleOnSafe();
        _fundTestAccounts();
        _labelContracts();
    }

    function _loadForkContracts() internal {
        safeSigner = CrossChain.multichainStrategist;
        vault = IVault(Base.OETHBaseVaultProxy);
        oethBase = IOToken(Base.OETHBaseProxy);
        bridgedWoeth = IERC4626(Base.BridgedWOETH);
        bridgedWOETHStrategy = IBridgedWOETHStrategy(Base.BridgedWOETHStrategyProxy);
        weth = IERC20(Base.WETH);
        baseGovernor = Base.governor;
    }

    function _deployModule() internal {
        baseBridgeHelperModule =
            IBaseBridgeHelperModule(vm.deployCode(Automation.BASE_BRIDGE_HELPER_MODULE, abi.encode(safeSigner)));
    }

    function _enableModuleOnSafe() internal {
        vm.prank(safeSigner);
        (bool success,) =
            safeSigner.call(abi.encodeWithSignature("enableModule(address)", address(baseBridgeHelperModule)));
        require(success, "Failed to enable module");
    }

    function _fundTestAccounts() internal {
        // Fund Safe with ETH for CCIP fees
        vm.deal(safeSigner, 100 ether);
    }

    function _labelContracts() internal {
        vm.label(address(baseBridgeHelperModule), "BaseBridgeHelperModule");
        vm.label(address(vault), "OETHBaseVault");
        vm.label(address(oethBase), "OETHBase");
        vm.label(address(bridgedWoeth), "BridgedWOETH");
        vm.label(address(bridgedWOETHStrategy), "BridgedWOETHStrategy");
        vm.label(Base.WETH, "WETH");
        vm.label(safeSigner, "SafeSigner");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Fund an address with bridged wOETH using deal
    function _mintBridgedWOETH(address to, uint256 amount) internal {
        deal(address(bridgedWoeth), to, amount);
    }

    /// @dev Fund an address with WETH by wrapping ETH
    function _fundWithWETH(address to, uint256 amount) internal {
        vm.deal(to, to.balance + amount);
        vm.prank(to);
        IWETH9(address(weth)).deposit{value: amount}();
    }
}
