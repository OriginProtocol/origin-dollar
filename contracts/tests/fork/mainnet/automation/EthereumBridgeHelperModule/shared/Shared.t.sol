// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IWETH9} from "contracts/interfaces/IWETH9.sol";
import {IWOToken} from "contracts/interfaces/IWOToken.sol";
import {IEthereumBridgeHelperModule} from "contracts/interfaces/automation/IEthereumBridgeHelperModule.sol";

abstract contract Fork_EthereumBridgeHelperModule_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IOToken internal oeth;
    IWOToken internal woeth;
    IVault internal oethVault;
    IEthereumBridgeHelperModule internal ethereumBridgeHelperModule;

    //////////////////////////////////////////////////////
    /// --- ADDRESSES
    //////////////////////////////////////////////////////

    address internal safeSigner;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();
        _loadForkContracts();
        _deployModule();
        _enableModuleOnSafe();
        _fundTestAccounts();
        _labelContracts();
    }

    function _loadForkContracts() internal {
        safeSigner = CrossChain.multichainStrategist;
        oeth = IOToken(Mainnet.OETHProxy);
        oethVault = IVault(Mainnet.OETHVaultProxy);
        woeth = IWOToken(Mainnet.WOETHProxy);
        weth = IERC20(Mainnet.WETH);
    }

    function _deployModule() internal {
        ethereumBridgeHelperModule = IEthereumBridgeHelperModule(
            vm.deployCode(Automation.ETHEREUM_BRIDGE_HELPER_MODULE, abi.encode(safeSigner))
        );
    }

    function _enableModuleOnSafe() internal {
        vm.prank(safeSigner);
        (bool success,) =
            safeSigner.call(abi.encodeWithSignature("enableModule(address)", address(ethereumBridgeHelperModule)));
        require(success, "Failed to enable module");
    }

    function _fundTestAccounts() internal {
        // Fund Safe with ETH for CCIP fees
        vm.deal(safeSigner, 100 ether);
    }

    function _labelContracts() internal {
        vm.label(address(ethereumBridgeHelperModule), "EthereumBridgeHelperModule");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(oeth), "OETH");
        vm.label(address(woeth), "WOETH");
        vm.label(Mainnet.WETH, "WETH");
        vm.label(safeSigner, "SafeSigner");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Fund the Safe with wOETH
    function _mintWOETHForSafe(uint256 amount) internal {
        deal(address(woeth), safeSigner, woeth.balanceOf(safeSigner) + amount);
    }

    /// @dev Fund the Safe with WETH by wrapping ETH
    function _fundSafeWithWETH(uint256 amount) internal {
        vm.deal(safeSigner, safeSigner.balance + amount);
        vm.prank(safeSigner);
        IWETH9(address(weth)).deposit{value: amount}();
    }
}
