// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Test utilities
import {Base} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "lib/openzeppelin/interfaces/IERC4626.sol";

// --- Project imports
import {IBaseBridgeHelperModule} from "contracts/interfaces/automation/IBaseBridgeHelperModule.sol";
import {IBridgedWOETHStrategy} from "contracts/interfaces/strategies/IBridgedWOETHStrategy.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IWETH9} from "contracts/interfaces/IWETH9.sol";

abstract contract Smoke_BaseBridgeHelperModule_Shared_Test is BaseSmoke {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IBaseBridgeHelperModule internal baseBridgeHelperModule;
    IBridgedWOETHStrategy internal bridgedWOETHStrategy;
    IVault internal vault;
    IERC4626 internal bridgedWoeth;

    //////////////////////////////////////////////////////
    /// --- ADDRESSES
    //////////////////////////////////////////////////////

    address internal safe;
    address internal baseGovernor;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkBase();
        _igniteDeployManager();
        _fetchContracts();
        _resolveActors();
        _labelContracts();
    }

    function _fetchContracts() internal virtual {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        baseBridgeHelperModule = IBaseBridgeHelperModule(resolver.resolve("BASE_BRIDGE_HELPER_MODULE"));
        vault = IVault(resolver.resolve("OETHBASE_VAULT_PROXY"));
        bridgedWoeth = IERC4626(resolver.resolve("BRIDGED_WOETH"));
        bridgedWOETHStrategy = IBridgedWOETHStrategy(resolver.resolve("BRIDGED_WOETH_STRATEGY_PROXY"));
        weth = IERC20(Base.WETH);
    }

    function _resolveActors() internal virtual {
        safe = address(baseBridgeHelperModule.safeContract());
        operator = baseBridgeHelperModule.getRoleMember(baseBridgeHelperModule.OPERATOR_ROLE(), 0);
        baseGovernor = vault.governor();
    }

    function _labelContracts() internal virtual {
        vm.label(address(baseBridgeHelperModule), "BaseBridgeHelperModule");
        vm.label(address(vault), "OETHBaseVault");
        vm.label(address(bridgedWoeth), "BridgedWOETH");
        vm.label(address(bridgedWOETHStrategy), "BridgedWOETHStrategy");
        vm.label(address(weth), "WETH");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Fund an address with WETH by wrapping ETH
    function _fundWithWETH(address to, uint256 amount) internal {
        vm.deal(to, to.balance + amount);
        vm.prank(to);
        IWETH9(Base.WETH).deposit{value: amount}();
    }
}
