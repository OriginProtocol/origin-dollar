// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {CrossChain, Base} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "lib/openzeppelin/interfaces/IERC4626.sol";
import {IWETH9} from "contracts/interfaces/IWETH9.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {OETHBase} from "contracts/token/OETHBase.sol";
import {BridgedWOETHStrategy} from "contracts/strategies/BridgedWOETHStrategy.sol";
import {BaseBridgeHelperModule} from "contracts/automation/BaseBridgeHelperModule.sol";

abstract contract Fork_BaseBridgeHelperModule_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    OETHBase internal oethBase;
    BridgedWOETHStrategy internal bridgedWOETHStrategy;
    BaseBridgeHelperModule internal baseBridgeHelperModule;
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
        oethBase = OETHBase(Base.OETHBaseProxy);
        bridgedWoeth = IERC4626(Base.BridgedWOETH);
        bridgedWOETHStrategy = BridgedWOETHStrategy(Base.BridgedWOETHStrategyProxy);
        weth = IERC20(Base.WETH);
        baseGovernor = Base.governor;
    }

    function _deployModule() internal {
        baseBridgeHelperModule = new BaseBridgeHelperModule(safeSigner);
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
